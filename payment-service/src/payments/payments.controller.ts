import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto, ConfirmPaymentDto } from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { RequestPayoutDto } from './dto/request-payout.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { WalletService } from './wallet.service.js';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly walletService: WalletService,
  ) {}

  /** Create a Stripe PaymentIntent — returns client_secret for the frontend */
  @Post('create-intent')
  createIntent(@Body() dto: CreatePaymentDto, @Request() req) {
    return this.paymentsService.createIntent(dto, req.user.id);
  }

  /** Confirm a payment after the frontend has completed Stripe checkout */
  @Post('confirm')
  confirm(@Body() dto: ConfirmPaymentDto, @Request() req) {
    return this.paymentsService.confirm(dto, req.user.id);
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

  /** Demander un retrait wallet vers Stripe Connect */
  @UseGuards(RolesGuard)
  @Roles('artist')
  @Post('wallet/payout')
  requestPayout(@Body() dto: RequestPayoutDto, @Request() req) {
    return this.walletService.requestPayout(
      req.user.id,
      req.headers.authorization,
      dto.amount_cents,
    );
  }

  /** Wallet artiste: snapshot balance + état Stripe */
  @UseGuards(RolesGuard)
  @Roles('artist')
  @Get('wallet/me')
  getMyWallet(@Request() req) {
    return this.walletService.getMyWallet(req.headers.authorization);
  }

  /** Wallet artiste: historique des transactions */
  @UseGuards(RolesGuard)
  @Roles('artist')
  @Get('wallet/my-transactions')
  getMyWalletTransactions(@Request() req) {
    return this.walletService.listMyTransactions(req.headers.authorization);
  }

  /** Wallet admin: historique global ou filtré par artiste */
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('wallet/admin/transactions')
  getAdminWalletTransactions(@Query('artist_id') artistId?: string) {
    if (artistId) {
      return this.walletService.listTransactionsByArtist(Number(artistId));
    }
    return this.walletService.listAllTransactions();
  }
}
