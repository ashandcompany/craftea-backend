import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ForbiddenException,
  Headers,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service.js';

@Controller('orders/internal')
export class OrdersInternalController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly configService: ConfigService,
  ) {}

  private assertInternalToken(serviceToken: string) {
    const expected = this.configService.get<string>('INTERNAL_SERVICE_TOKEN', '');
    if (!expected || serviceToken !== expected) {
      throw new ForbiddenException('Invalid service token');
    }
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-service-token') serviceToken: string,
  ) {
    this.assertInternalToken(serviceToken);
    // Bypass user ownership check — internal service call
    const order = await this.ordersService.findOneInternal(id);
    if (!order) throw new NotFoundException('Commande introuvable');
    return order;
  }
}
