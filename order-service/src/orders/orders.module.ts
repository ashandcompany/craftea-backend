import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity.js';
import { OrderItem } from './entities/order-item.entity.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { OrdersInternalController } from './orders-internal.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem]), HttpModule],
  controllers: [OrdersController, OrdersInternalController],
  providers: [OrdersService],
})
export class OrdersModule {}
