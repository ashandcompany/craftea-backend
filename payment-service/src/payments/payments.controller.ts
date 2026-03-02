import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /** Créer un paiement via Square */
  @Post()
  create(@Body() dto: CreatePaymentDto, @Request() req) {
    return this.paymentsService.create(dto, req.user.id);
  }

  /** Mes paiements */
  @Get('my')
  findMyPayments(@Request() req) {
    return this.paymentsService.findByUser(req.user.id);
  }

  /** Paiements liés à une commande */
  @Get('order/:orderId')
  findByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentsService.findByOrder(orderId);
  }

  /** Tous les paiements (admin) */
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  /** Détail d'un paiement */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.paymentsService.findOne(id, req.user);
  }

  /** Rembourser un paiement */
  @Post(':id/refund')
  refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefundPaymentDto,
    @Request() req,
  ) {
    return this.paymentsService.refund(id, dto, req.user);
  }
}
