import { Global, Module } from '@nestjs/common';
import { PaymentEventsPublisher } from './payment-events.publisher.js';

@Global()
@Module({
  providers: [PaymentEventsPublisher],
  exports: [PaymentEventsPublisher],
})
export class PaymentEventsModule {}
