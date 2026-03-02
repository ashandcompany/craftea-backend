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
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { SquareService } from './square.service.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private paymentsRepo: Repository<Payment>,
    private readonly squareService: SquareService,
  ) {}

  async create(dto: CreatePaymentDto, userId: number): Promise<Payment> {
    const idempotencyKey = uuidv4();

    // Square expects amounts in the smallest currency unit (cents for EUR)
    const amountInCents = Math.round(dto.amount * 100);
    const currency = dto.currency ?? 'EUR';

    // Persist the payment intent locally first
    const payment = this.paymentsRepo.create({
      user_id: userId,
      order_id: dto.order_id ?? undefined,
      amount: dto.amount,
      currency,
      status: PaymentStatus.PENDING,
      idempotency_key: idempotencyKey,
      source_id: dto.source_id,
    });
    await this.paymentsRepo.save(payment);

    try {
      const result = await this.squareService.createPayment({
        amount: amountInCents,
        currency,
        source_id: dto.source_id,
        idempotency_key: idempotencyKey,
      });

      if (result.errors && result.errors.length > 0) {
        payment.status = PaymentStatus.FAILED;
        payment.error_detail = result.errors.map((e) => e.detail).join('; ');
        await this.paymentsRepo.save(payment);
        throw new BadRequestException(payment.error_detail);
      }

      payment.square_payment_id = result.payment.id;
      payment.square_receipt_url = result.payment.receipt_url ?? undefined;
      payment.status =
        result.payment.status === 'COMPLETED'
          ? PaymentStatus.COMPLETED
          : PaymentStatus.PENDING;
      await this.paymentsRepo.save(payment);

      return payment;
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;

      const detail =
        error?.response?.data?.errors?.[0]?.detail ||
        error?.message ||
        'Erreur lors du paiement Square';

      payment.status = PaymentStatus.FAILED;
      payment.error_detail = detail;
      await this.paymentsRepo.save(payment);

      this.logger.error(`Square payment failed: ${detail}`);
      throw new BadRequestException(detail);
    }
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

    if (!payment.square_payment_id) {
      throw new BadRequestException('Aucun identifiant de paiement Square associé');
    }

    const refundIdempotencyKey = uuidv4();
    const amountInCents = Math.round(payment.amount * 100);

    try {
      const result = await this.squareService.refundPayment({
        payment_id: payment.square_payment_id,
        amount: amountInCents,
        currency: payment.currency,
        idempotency_key: refundIdempotencyKey,
        reason: dto.reason,
      });

      if (result.errors && result.errors.length > 0) {
        const detail = result.errors.map((e) => e.detail).join('; ');
        throw new BadRequestException(detail);
      }

      payment.status = PaymentStatus.REFUNDED;
      await this.paymentsRepo.save(payment);

      return payment;
    } catch (error: any) {
      if (error instanceof BadRequestException) throw error;

      const detail =
        error?.response?.data?.errors?.[0]?.detail ||
        error?.message ||
        'Erreur lors du remboursement Square';

      this.logger.error(`Square refund failed: ${detail}`);
      throw new BadRequestException(detail);
    }
  }

  async findAll(): Promise<Payment[]> {
    return this.paymentsRepo.find({ order: { created_at: 'DESC' } });
  }
}
