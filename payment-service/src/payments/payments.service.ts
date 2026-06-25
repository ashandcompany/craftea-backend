import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentStatus } from './entities/payment.entity.js';
import {
  CreatePaymentDto,
  ConfirmPaymentDto,
} from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { StripeService } from './stripe.service.js';
import { WalletService } from './wallet.service.js';
import { OrderCompletedEventDto } from './dto/order-completed-event.dto.js';
import { calculateFee } from './commission.constants.js';
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private applyIntentStatus(payment: Payment, intent: Stripe.PaymentIntent) {
    if (intent.status === 'succeeded') {
      payment.status = PaymentStatus.COMPLETED;
      const latestCharge = intent.latest_charge;
      if (
        latestCharge &&
        typeof latestCharge === 'object' &&
        'receipt_url' in latestCharge
      ) {
        payment.stripe_receipt_url =
          (latestCharge as any).receipt_url ?? undefined;
      }
      return;
    }

    if (
      intent.status === 'requires_payment_method' ||
      intent.status === 'canceled'
    ) {
      payment.status = PaymentStatus.FAILED;
      payment.error_detail = `Stripe status: ${intent.status}`;
    }
    // processing / requires_action => keep pending
  }

  private readonly logger = new Logger(PaymentsService.name);
  private readonly orderUrl: string;
  private readonly artistUrl: string;

  constructor(
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    private readonly stripeService: StripeService,
    private readonly walletService: WalletService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.orderUrl = this.configService.get<string>(
      'ORDER_URL',
      'http://order-service:3005',
    );
    this.artistUrl = this.configService.get<string>(
      'ARTIST_URL',
      'http://artist-service:3002',
    );
  }

  /**
   * Step 1 – Create a Stripe PaymentIntent and persist a local Payment row.
   * Returns the Payment with `stripe_client_secret` so the frontend can
   * confirm payment via Stripe.js.
   */
  /**
   * Resolves the artist's Stripe account ID from the order items.
   * Looks up shop → artist → stripe_account_id.
   */
  private async resolveArtistStripeAccount(
    orderId: number,
  ): Promise<string | null> {
    try {
      // Get order with items to find shop_ids (internal endpoint, no JWT needed)
      const { data: order } = await firstValueFrom(
        this.httpService.get(
          `${this.orderUrl}/api/orders/internal/${orderId}`,
          {
            headers: {
              'x-service-token': this.configService.get<string>(
                'INTERNAL_SERVICE_TOKEN',
                '',
              ),
            },
          },
        ),
      );

      const shopIds = [
        ...new Set(
          (order?.items || [])
            .map((item: any) => item.shop_id)
            .filter((id: number | undefined): id is number => id != null),
        ),
      ];

      if (shopIds.length === 0) return null;

      // Get the first shop's artist (destination charges only support one destination)
      const { data: shop } = await firstValueFrom(
        this.httpService.get(`${this.artistUrl}/api/shops/${shopIds[0]}`),
      );

      if (!shop?.artist_id) return null;

      // Get the artist profile to find stripe_account_id
      const { data: artist } = await firstValueFrom(
        this.httpService.get(`${this.artistUrl}/api/artists/${shop.artist_id}`),
      );

      if (!artist?.stripe_account_id || !artist?.stripe_onboarded) return null;

      return artist.stripe_account_id;
    } catch (error) {
      this.logger.warn(
        `Could not resolve artist Stripe account for order ${orderId}: ${error}`,
      );
      return null;
    }
  }

  async createIntent(dto: CreatePaymentDto, userId: number): Promise<Payment> {
    const idempotencyKey = uuidv4();
    const amountInCents = Math.round(dto.amount * 100);
    const currency = dto.currency ?? 'EUR';
    const platformFeeCents = calculateFee(amountInCents);
    const artistAmountCents = amountInCents - platformFeeCents;

    // Resolve artist's Stripe connected account from the order
    let artistStripeAccountId = dto.artist_stripe_account_id ?? '';
    if (!artistStripeAccountId && dto.order_id) {
      const resolved = await this.resolveArtistStripeAccount(dto.order_id);
      if (resolved) artistStripeAccountId = resolved;
    }

    // Use destination charges when we have a valid connected account
    const useDestinationCharge = Boolean(artistStripeAccountId);

    const intent = await this.stripeService.createPaymentIntent({
      amount: amountInCents,
      currency,
      idempotencyKey,
      metadata: {
        user_id: String(userId),
        order_id: dto.order_id ? String(dto.order_id) : '',
        artistStripeAccountId,
        platformFee: String(platformFeeCents),
      },
      // Destination charge: Stripe splits funds automatically
      ...(useDestinationCharge
        ? {
            applicationFeeAmount: platformFeeCents,
            transferDestination: artistStripeAccountId,
          }
        : {}),
    });

    const payment = this.paymentsRepo.create({
      user_id: userId,
      order_id: dto.order_id ?? undefined,
      amount: dto.amount,
      amount_cents: amountInCents,
      platform_fee_cents: platformFeeCents,
      artist_amount_cents: artistAmountCents,
      artist_stripe_account_id: artistStripeAccountId || undefined,
      currency,
      status: PaymentStatus.PENDING,
      idempotency_key: idempotencyKey,
      stripe_payment_intent_id: intent.id,
      stripe_client_secret: intent.client_secret ?? undefined,
      wallet_credited: false,
    });
    await this.paymentsRepo.save(payment);

    return payment;
  }

  async handleOrderCompleted(
    payload: OrderCompletedEventDto,
  ): Promise<Payment | { skipped: true }> {
    const payment = await this.paymentsRepo.findOne({
      where: { order_id: payload.orderId },
      order: { created_at: 'DESC' },
    });

    if (!payment) {
      this.logger.warn(
        `No payment found for completed order ${payload.orderId}`,
      );
      return { skipped: true };
    }

    if (payment.wallet_credited) {
      return payment;
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      this.logger.warn(
        `Order ${payload.orderId} completed but payment ${payment.id} not completed yet (status=${payment.status})`,
      );
      return { skipped: true };
    }

    const artistAmountCents = Number(payment.artist_amount_cents ?? 0);
    if (artistAmountCents <= 0) {
      this.logger.warn(`Payment ${payment.id} has no artist amount to credit`);
      return { skipped: true };
    }

    const credits = this.computeArtistCredits(artistAmountCents, payload);
    if (credits.length === 0) {
      this.logger.warn(`No artist split found for order ${payload.orderId}`);
      return { skipped: true };
    }

    for (const credit of credits) {
      if (credit.amountCents <= 0) continue;
      await this.walletService.credit(
        credit.artistId,
        credit.amountCents,
        payload.orderId,
      );
    }

    payment.wallet_credited = true;
    payment.wallet_credited_at = new Date();
    await this.paymentsRepo.save(payment);

    return payment;
  }

  async handleOrderConfirmed(
    payload: OrderCompletedEventDto,
  ): Promise<{ success: true } | { skipped: true }> {
    const payment = await this.paymentsRepo.findOne({
      where: { order_id: payload.orderId },
      order: { created_at: 'DESC' },
    });

    if (!payment || payment.status !== PaymentStatus.COMPLETED) {
      this.logger.warn(
        `Order ${payload.orderId} confirmed but payment not found or not completed`,
      );
      return { skipped: true };
    }

    const artistAmountCents = Number(payment.artist_amount_cents ?? 0);
    if (artistAmountCents <= 0) return { skipped: true };

    const credits = this.computeArtistCredits(artistAmountCents, payload);
    if (credits.length === 0) return { skipped: true };

    for (const credit of credits) {
      if (credit.amountCents <= 0) continue;
      await this.walletService.creditPending(
        credit.artistId,
        credit.amountCents,
        payload.orderId,
      );
    }

    return { success: true };
  }

  async handleOrderCancelled(
    payload: OrderCompletedEventDto,
  ): Promise<{ success: true } | { skipped: true }> {
    const payment = await this.paymentsRepo.findOne({
      where: { order_id: payload.orderId },
      order: { created_at: 'DESC' },
    });

    if (!payment) return { skipped: true };

    const artistAmountCents = Number(payment.artist_amount_cents ?? 0);
    if (artistAmountCents <= 0) return { skipped: true };

    const credits = this.computeArtistCredits(artistAmountCents, payload);
    for (const credit of credits) {
      if (credit.amountCents <= 0) continue;
      await this.walletService.cancelPending(
        credit.artistId,
        credit.amountCents,
        payload.orderId,
      );
    }

    return { success: true };
  }

  private computeArtistCredits(
    totalArtistAmountCents: number,
    payload: OrderCompletedEventDto,
  ): Array<{ artistId: number; amountCents: number }> {
    const splits = (payload.splits ?? []).filter(
      (s) => s.artistId > 0 && s.grossAmount > 0,
    );

    if (splits.length === 0 && payload.artistId) {
      return [
        { artistId: payload.artistId, amountCents: totalArtistAmountCents },
      ];
    }

    if (splits.length === 1) {
      return [
        { artistId: splits[0].artistId, amountCents: totalArtistAmountCents },
      ];
    }

    const grossTotal = splits.reduce((sum, s) => sum + s.grossAmount, 0);
    if (grossTotal <= 0) return [];

    const base = splits.map((s) => {
      const exact = (totalArtistAmountCents * s.grossAmount) / grossTotal;
      const floored = Math.floor(exact);
      return {
        artistId: s.artistId,
        amountCents: floored,
        remainder: exact - floored,
      };
    });

    const allocated = base.reduce((sum, b) => sum + b.amountCents, 0);
    let remaining = totalArtistAmountCents - allocated;

    base.sort((a, b) => b.remainder - a.remainder);
    let idx = 0;
    while (remaining > 0 && base.length > 0) {
      base[idx % base.length].amountCents += 1;
      remaining -= 1;
      idx += 1;
    }

    return base.map((b) => ({
      artistId: b.artistId,
      amountCents: b.amountCents,
    }));
  }

  /**
   * Step 2 – After the frontend confirms payment, it calls this endpoint
   * so the backend can verify the PaymentIntent status and update the record.
   */
  async confirm(dto: ConfirmPaymentDto, userId: number): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({
      where: {
        stripe_payment_intent_id: dto.payment_intent_id,
        user_id: userId,
      },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    const intent = await this.stripeService.retrievePaymentIntent(
      dto.payment_intent_id,
    );

    this.applyIntentStatus(payment, intent);

    await this.paymentsRepo.save(payment);
    return payment;
  }

  async confirmPaymentFromWebhook(
    intent: Stripe.PaymentIntent,
  ): Promise<Payment | null> {
    const payment = await this.paymentsRepo.findOne({
      where: { stripe_payment_intent_id: intent.id },
      order: { created_at: 'DESC' },
    });

    if (!payment) {
      this.logger.warn(`Webhook Stripe reçu pour PI inconnue: ${intent.id}`);
      return null;
    }

    this.applyIntentStatus(payment, intent);
    await this.paymentsRepo.save(payment);

    // ── Auto-confirm order when payment succeeds ────────────────────────
    if (payment.status === PaymentStatus.COMPLETED && payment.order_id) {
      try {
        await firstValueFrom(
          this.httpService.patch(
            `${this.orderUrl}/api/orders/internal/${payment.order_id}/status`,
            { status: 'confirmed' },
            {
              headers: {
                'x-service-token': this.configService.get<string>(
                  'INTERNAL_SERVICE_TOKEN',
                  '',
                ),
              },
            },
          ),
        );
        this.logger.debug(
          `Order ${payment.order_id} auto-confirmed via payment webhook`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to auto-confirm order ${payment.order_id} after successful payment: ${err}`,
        );
      }
    }

    return payment;
  }

  /**
   * Handle a charge.refunded webhook event.
   * Marks the payment as REFUNDED and reverses wallet credits for the related order.
   */
  async handleChargeRefundedFromWebhook(charge: Stripe.Charge): Promise<void> {
    const piId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!piId) {
      this.logger.warn(`charge.refunded sans payment_intent: ${charge.id}`);
      return;
    }

    const payment = await this.paymentsRepo.findOne({
      where: { stripe_payment_intent_id: piId },
      order: { created_at: 'DESC' },
    });

    if (!payment) {
      this.logger.warn(`charge.refunded: aucun paiement local pour PI ${piId}`);
      return;
    }

    // Mark payment as refunded (idempotent)
    if (payment.status !== PaymentStatus.REFUNDED) {
      payment.status = PaymentStatus.REFUNDED;
      await this.paymentsRepo.save(payment);
    }

    // Reverse wallet credits if they were applied
    if (payment.wallet_credited && payment.order_id) {
      const artistAmountCents = Number(payment.artist_amount_cents ?? 0);
      if (artistAmountCents > 0) {
        const credits = this.computeArtistCredits(artistAmountCents, {
          orderId: payment.order_id,
          artistId: Number(payment.artist_stripe_account_id ? 0 : 0),
        } as OrderCompletedEventDto);

        // If we can't compute splits, use the order lookup fallback
        if (credits.length === 0 && payment.order_id) {
          try {
            const resolved = await this.resolveArtistIdFromOrder(
              payment.order_id,
            );
            if (resolved) {
              await this.walletService.cancelPending(
                resolved,
                artistAmountCents,
                payment.order_id,
              );
            }
          } catch (error) {
            this.logger.error(
              `Failed to reverse wallet for refund on order ${payment.order_id}: ${error}`,
            );
          }
        } else {
          for (const credit of credits) {
            if (credit.amountCents <= 0) continue;
            await this.walletService.cancelPending(
              credit.artistId,
              credit.amountCents,
              payment.order_id,
            );
          }
        }

        payment.wallet_credited = false;
        await this.paymentsRepo.save(payment);
      }
    }

    this.logger.log(`charge.refunded traité pour PI ${piId}`);
  }

  /**
   * Resolve artist ID from order (for refund reversal).
   */
  private async resolveArtistIdFromOrder(
    orderId: number,
  ): Promise<number | null> {
    try {
      const { data: order } = await firstValueFrom(
        this.httpService.get(
          `${this.orderUrl}/api/orders/internal/${orderId}`,
          {
            headers: {
              'x-service-token': this.configService.get<string>(
                'INTERNAL_SERVICE_TOKEN',
                '',
              ),
            },
          },
        ),
      );

      const shopIds = [
        ...new Set(
          (order?.items || [])
            .map((item: any) => item.shop_id)
            .filter((id: number | undefined): id is number => id != null),
        ),
      ];

      if (shopIds.length === 0) return null;

      const { data: shop } = await firstValueFrom(
        this.httpService.get(`${this.artistUrl}/api/shops/${shopIds[0]}`),
      );

      return shop?.artist_id ?? null;
    } catch (error) {
      this.logger.warn(
        `Could not resolve artist ID for order ${orderId}: ${error}`,
      );
      return null;
    }
  }

  async findByUser(userId: number): Promise<Payment[]> {
    return this.paymentsRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(
    id: number,
    currentUser: { id: number; role: string },
  ): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    if (currentUser.role !== 'admin' && payment.user_id !== currentUser.id) {
      throw new ForbiddenException('Accès interdit');
    }

    return payment;
  }

  async findByOrder(orderId: number): Promise<Payment[]> {
    return this.paymentsRepo.find({
      where: { order_id: orderId },
      order: { created_at: 'DESC' },
    });
  }

  async refund(
    id: number,
    dto: RefundPaymentDto,
    currentUser: { id: number; role: string },
  ): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    if (currentUser.role !== 'admin' && payment.user_id !== currentUser.id) {
      throw new ForbiddenException('Accès interdit');
    }

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException(
        'Seul un paiement complété peut être remboursé',
      );
    }

    if (!payment.stripe_payment_intent_id) {
      throw new BadRequestException('Aucun identifiant Stripe associé');
    }

    const refundIdempotencyKey = uuidv4();

    try {
      await this.stripeService.refund({
        paymentIntentId: payment.stripe_payment_intent_id,
        idempotencyKey: refundIdempotencyKey,
        reason: dto.reason,
      });

      payment.status = PaymentStatus.REFUNDED;
      await this.paymentsRepo.save(payment);
      return payment;
    } catch (error: any) {
      const detail = error?.message || 'Erreur lors du remboursement Stripe';
      this.logger.error(`Stripe refund failed: ${detail}`);
      throw new BadRequestException(detail);
    }
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentsRepo.find({ order: { created_at: 'DESC' } });
  }
}
