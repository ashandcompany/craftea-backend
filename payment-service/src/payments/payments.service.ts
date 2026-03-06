import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Payment, PaymentStatus } from './entities/payment.entity.js';
import { CreatePaymentDto, ConfirmPaymentDto } from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { StripeService } from './stripe.service.js';
import { WalletService } from './wallet.service.js';
import { OrderCompletedEventDto } from './dto/order-completed-event.dto.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    private readonly stripeService: StripeService,
    private readonly walletService: WalletService,
  ) {}

  /**
   * Step 1 – Create a Stripe PaymentIntent and persist a local Payment row.
   * Returns the Payment with `stripe_client_secret` so the frontend can
   * confirm payment via Stripe.js.
   */
  async createIntent(dto: CreatePaymentDto, userId: number): Promise<Payment> {
    const idempotencyKey = uuidv4();
    const amountInCents = Math.round(dto.amount * 100);
    const currency = dto.currency ?? 'EUR';
    const platformFeePercent = 0.10;
    const platformFeeCents = Math.round(amountInCents * platformFeePercent);
    const artistAmountCents = amountInCents - platformFeeCents;
    const artistStripeAccountId = dto.artist_stripe_account_id ?? '';

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
    });

    const payment = this.paymentsRepo.create({
      user_id: userId,
      order_id: dto.order_id ?? undefined,
      amount: dto.amount,
      amount_cents: amountInCents,
      platform_fee_cents: platformFeeCents,
      artist_amount_cents: artistAmountCents,
      artist_stripe_account_id: dto.artist_stripe_account_id ?? undefined,
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

  async handleOrderCompleted(payload: OrderCompletedEventDto): Promise<Payment | { skipped: true }> {
    const payment = await this.paymentsRepo.findOne({
      where: { order_id: payload.orderId },
      order: { created_at: 'DESC' },
    });

    if (!payment) {
      this.logger.warn(`No payment found for completed order ${payload.orderId}`);
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
      await this.walletService.credit(credit.artistId, credit.amountCents, payload.orderId);
    }

    payment.wallet_credited = true;
    payment.wallet_credited_at = new Date();
    await this.paymentsRepo.save(payment);

    return payment;
  }

  private computeArtistCredits(
    totalArtistAmountCents: number,
    payload: OrderCompletedEventDto,
  ): Array<{ artistId: number; amountCents: number }> {
    const splits = (payload.splits ?? []).filter((s) => s.artistId > 0 && s.grossAmount > 0);

    if (splits.length === 0 && payload.artistId) {
      return [{ artistId: payload.artistId, amountCents: totalArtistAmountCents }];
    }

    if (splits.length === 1) {
      return [{ artistId: splits[0].artistId, amountCents: totalArtistAmountCents }];
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

    let allocated = base.reduce((sum, b) => sum + b.amountCents, 0);
    let remaining = totalArtistAmountCents - allocated;

    base.sort((a, b) => b.remainder - a.remainder);
    let idx = 0;
    while (remaining > 0 && base.length > 0) {
      base[idx % base.length].amountCents += 1;
      remaining -= 1;
      idx += 1;
    }

    return base.map((b) => ({ artistId: b.artistId, amountCents: b.amountCents }));
  }

  /**
   * Step 2 – After the frontend confirms payment, it calls this endpoint
   * so the backend can verify the PaymentIntent status and update the record.
   */
  async confirm(dto: ConfirmPaymentDto, userId: number): Promise<Payment> {
    const payment = await this.paymentsRepo.findOne({
      where: { stripe_payment_intent_id: dto.payment_intent_id, user_id: userId },
    });
    if (!payment) throw new NotFoundException('Paiement introuvable');

    const intent = await this.stripeService.retrievePaymentIntent(dto.payment_intent_id);

    if (intent.status === 'succeeded') {
      payment.status = PaymentStatus.COMPLETED;
      const latestCharge = intent.latest_charge;
      if (latestCharge && typeof latestCharge === 'object' && 'receipt_url' in latestCharge) {
        payment.stripe_receipt_url = (latestCharge as any).receipt_url ?? undefined;
      }
    } else if (intent.status === 'requires_payment_method' || intent.status === 'canceled') {
      payment.status = PaymentStatus.FAILED;
      payment.error_detail = `Stripe status: ${intent.status}`;
    }
    // Other statuses (processing, requires_action…) stay PENDING

    await this.paymentsRepo.save(payment);
    return payment;
  }

  async findByUser(userId: number): Promise<Payment[]> {
    return this.paymentsRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number, currentUser: { id: number; role: string }): Promise<Payment> {
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
      throw new BadRequestException('Seul un paiement complété peut être remboursé');
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
