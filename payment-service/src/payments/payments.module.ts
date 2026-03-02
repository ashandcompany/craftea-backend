import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { SquareService } from './square.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment]),
    HttpModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, SquareService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
