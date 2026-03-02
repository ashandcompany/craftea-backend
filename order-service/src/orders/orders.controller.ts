import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // Créer une commande
  @Post()
  create(@Body() dto: CreateOrderDto, @Request() req) {
    return this.ordersService.create(dto, req.user.id);
  }

  // Historique d'achats de l'utilisateur connecté
  @Get('my')
  findMyOrders(@Request() req) {
    return this.ordersService.findByUser(req.user.id);
  }

  // Toutes les commandes (admin)
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  // Détail d'une commande
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.ordersService.findOne(id, req.user);
  }

  // Mettre à jour le statut
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req,
  ) {
    return this.ordersService.updateStatus(id, dto, req.user);
  }
}
