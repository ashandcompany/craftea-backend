import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service.js';
import { OrderCompletedEventDto } from './dto/order-completed-event.dto.js';

@Controller('payments/events')
export class PaymentsEventsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post('order-completed')
  handleOrderCompleted(
    @Body() dto: OrderCompletedEventDto,
    @Headers('x-service-token') serviceToken: string,
  ) {
    const expected = this.configService.get<string>('INTERNAL_SERVICE_TOKEN', '');
    if (!expected || serviceToken !== expected) {
      throw new ForbiddenException('Invalid service token');
    }

    return this.paymentsService.handleOrderCompleted(dto);
  }
}
