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
  HttpCode,
  Headers,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto, ConfirmPaymentDto } from './dto/create-payment.dto.js';
import { RefundPaymentDto } from './dto/refund-payment.dto.js';
import { RequestPayoutDto } from './dto/request-payout.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { WalletService } from './wallet.service.js';
import { StripeService } from './stripe.service.js';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity.js';
import type Stripe from 'stripe';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly walletService: WalletService,
    private readonly stripeService: StripeService,
    @InjectRepository(ProcessedWebhookEvent)
    private readonly webhookEventRepo: Repository<ProcessedWebhookEvent>,
  ) {}

  /** Webhook Stripe: confirmation serveur-side signée */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Signature Stripe manquante');
    }

    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body Stripe indisponible');
    }

    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(rawBody, signature);
    } catch (error: unknown) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Signature Stripe invalide',
      );
    }

    // ── Idempotency: skip already-processed events ──────────────────────
    const existing = await this.webhookEventRepo.findOne({
      where: { stripe_event_id: event.id },
    });
    if (existing) {
      this.logger.debug(`Webhook déjà traité: ${event.id} (${event.type})`);
      return { received: true };
    }

    // ── Dispatch ────────────────────────────────────────────────────────
    switch (event.type as string) {
      case 'payment_intent.succeeded': {
        await this.paymentsService.confirmPaymentFromWebhook(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await this.paymentsService.handleChargeRefundedFromWebhook(charge);
        break;
      }

      case 'transfer.failed': {
        await this.walletService.handleTransferFailed((event.data as any).object as { id: string });
        break;
      }

      case 'payout.failed': {
        await this.walletService.handlePayoutFailed((event.data as any).object as { id: string });
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.payouts_enabled) {
          await this.walletService.markArtistStripeReady(account.id);
        } else {
          await this.walletService.markArtistStripeNotReady(account.id);
        }
        break;
      }

      default:
        this.logger.debug(`Stripe webhook ignoré: ${event.type}`);
    }

    // ── Mark event as processed ─────────────────────────────────────────
    await this.webhookEventRepo.save(
      this.webhookEventRepo.create({
        stripe_event_id: event.id,
        event_type: event.type,
      }),
    );

    return { received: true };
  }

  /** Create a Stripe PaymentIntent — returns client_secret for the frontend */
  @UseGuards(JwtAuthGuard)
  @Post('create-intent')
  createIntent(@Body() dto: CreatePaymentDto, @Request() req) {
    return this.paymentsService.createIntent(dto, req.user.id);
  }

  /** Confirm a payment after the frontend has completed Stripe checkout */
  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  confirm(@Body() dto: ConfirmPaymentDto, @Request() req) {
    return this.paymentsService.confirm(dto, req.user.id);
  }

  /** Mes paiements */
  @UseGuards(JwtAuthGuard)
  @Get('my')
  findMyPayments(@Request() req) {
    return this.paymentsService.findByUser(req.user.id);
  }

  /** Paiements liés à une commande */
  @UseGuards(JwtAuthGuard)
  @Get('order/:orderId')
  findByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.paymentsService.findByOrder(orderId);
  }

  /** Tous les paiements (admin) */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.paymentsService.findAll();
  }

  /** Détail d'un paiement */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.paymentsService.findOne(id, req.user);
  }

  /** Rembourser un paiement */
  @UseGuards(JwtAuthGuard)
  @Post(':id/refund')
  refund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RefundPaymentDto,
    @Request() req,
  ) {
    return this.paymentsService.refund(id, dto, req.user);
  }

  /** Demander un retrait wallet vers Stripe Connect */
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Get('wallet/me')
  getMyWallet(@Request() req) {
    return this.walletService.getMyWallet(req.headers.authorization);
  }

  /** Wallet artiste: historique des transactions */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('artist')
  @Get('wallet/my-transactions')
  getMyWalletTransactions(@Request() req) {
    return this.walletService.listMyTransactions(req.headers.authorization);
  }

  /** Wallet admin: historique global ou filtré par artiste */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('wallet/admin/transactions')
  getAdminWalletTransactions(@Query('artist_id') artistId?: string) {
    if (artistId) {
      return this.walletService.listTransactionsByArtist(Number(artistId));
    }
    return this.walletService.listAllTransactions();
  }
}
