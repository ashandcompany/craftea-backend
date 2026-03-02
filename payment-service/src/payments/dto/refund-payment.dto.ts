import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '../entities/payment.entity.js';

export class RefundPaymentDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
