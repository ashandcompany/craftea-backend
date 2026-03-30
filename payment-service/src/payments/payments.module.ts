import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity.js';
import { WalletTransaction } from './entities/wallet-transaction.entity.js';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { StripeService } from './stripe.service.js';
import { WalletService } from './wallet.service.js';
import { PaymentsEventsController } from './payments.events.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, WalletTransaction, ProcessedWebhookEvent]),
    HttpModule,
  ],
  controllers: [PaymentsController, PaymentsEventsController],
  providers: [PaymentsService, StripeService, WalletService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
