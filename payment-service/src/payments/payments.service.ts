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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    private readonly stripeService: StripeService,
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

    const intent = await this.stripeService.createPaymentIntent({
      amount: amountInCents,
      currency,
      idempotencyKey,
      metadata: {
        user_id: String(userId),
        order_id: dto.order_id ? String(dto.order_id) : '',
      },
    });

    const payment = this.paymentsRepo.create({
      user_id: userId,
      order_id: dto.order_id ?? undefined,
      amount: dto.amount,
      currency,
      status: PaymentStatus.PENDING,
      idempotency_key: idempotencyKey,
      stripe_payment_intent_id: intent.id,
      stripe_client_secret: intent.client_secret ?? undefined,
    });
    await this.paymentsRepo.save(payment);

    return payment;
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
