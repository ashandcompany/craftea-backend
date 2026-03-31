import { Global, Module } from '@nestjs/common';
import { OrderEventsPublisher } from './order-events.publisher.js';

@Global()
@Module({
  providers: [OrderEventsPublisher],
  exports: [OrderEventsPublisher],
})
export class OrderEventsModule {}
