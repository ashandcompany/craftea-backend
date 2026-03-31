import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EmailService } from './email.service.js';
import { orderConfirmationTemplate } from './templates/order-confirmation.template.js';
import { stripeKycInviteTemplate } from './templates/stripe-kyc-invite.template.js';
import { stripeKycConfirmedTemplate } from './templates/stripe-kyc-confirmed.template.js';
import { payoutSentTemplate } from './templates/payout-sent.template.js';
import { payoutFailedTemplate } from './templates/payout-failed.template.js';

interface OrderConfirmedPayload {
  buyerEmail: string;
  orderNumber: string;
  items: { name: string; qty: number; unitPrice: number }[];
  total: number;
  commissionAmount: number;
  orderUrl: string;
}

interface ArtistKycPayload {
  artistEmail: string;
  artistName: string;
  onboardingUrl?: string;
}

interface PayoutPayload {
  artistEmail: string;
  amount: number;
  currency: string;
  estimatedDays?: number;
}

@Controller()
export class NotificationConsumer {
  private readonly logger = new Logger(NotificationConsumer.name);

  constructor(private readonly email: EmailService) {}

  @EventPattern('order.confirmed')
  async handleOrderConfirmed(@Payload() payload: OrderConfirmedPayload) {
    this.logger.log(`[order.confirmed] orderNumber=${payload.orderNumber} to=${payload.buyerEmail}`);
    try {
      const html = orderConfirmationTemplate({
        orderNumber: payload.orderNumber,
        items: payload.items,
        total: payload.total,
        commissionAmount: payload.commissionAmount,
        orderUrl: payload.orderUrl,
      });
      await this.email.send(payload.buyerEmail, `Confirmation de commande #${payload.orderNumber}`, html);
    } catch (err) {
      this.logger.error(`[order.confirmed] handler error: ${(err as Error).message}`);
    }
  }

  @EventPattern('artist.kyc-invited')
  async handleArtistKycInvited(@Payload() payload: ArtistKycPayload) {
    this.logger.log(`[artist.kyc-invited] artist=${payload.artistName} to=${payload.artistEmail}`);
    try {
      const html = stripeKycInviteTemplate({
        artistName: payload.artistName,
        onboardingUrl: payload.onboardingUrl ?? '',
      });
      await this.email.send(payload.artistEmail, 'Vérifiez votre identité sur Craftea', html);
    } catch (err) {
      this.logger.error(`[artist.kyc-invited] handler error: ${(err as Error).message}`);
    }
  }

  @EventPattern('artist.kyc-verified')
  async handleArtistKycVerified(@Payload() payload: ArtistKycPayload) {
    this.logger.log(`[artist.kyc-verified] artist=${payload.artistName} to=${payload.artistEmail}`);
    try {
      const html = stripeKycConfirmedTemplate({ artistName: payload.artistName });
      await this.email.send(payload.artistEmail, 'Votre identité a été vérifiée ✓', html);
    } catch (err) {
      this.logger.error(`[artist.kyc-verified] handler error: ${(err as Error).message}`);
    }
  }

  @EventPattern('payout.succeeded')
  async handlePayoutSucceeded(@Payload() payload: PayoutPayload) {
    this.logger.log(`[payout.succeeded] amount=${payload.amount} to=${payload.artistEmail}`);
    try {
      const html = payoutSentTemplate({
        amount: payload.amount,
        currency: payload.currency,
        estimatedDays: payload.estimatedDays ?? 2,
      });
      await this.email.send(payload.artistEmail, 'Votre virement a été initié', html);
    } catch (err) {
      this.logger.error(`[payout.succeeded] handler error: ${(err as Error).message}`);
    }
  }

  @EventPattern('payout.failed')
  async handlePayoutFailed(@Payload() payload: PayoutPayload) {
    this.logger.log(`[payout.failed] amount=${payload.amount} to=${payload.artistEmail}`);
    try {
      const html = payoutFailedTemplate({
        amount: payload.amount,
        currency: payload.currency,
      });
      await this.email.send(payload.artistEmail, 'Échec de votre virement Craftea', html);
    } catch (err) {
      this.logger.error(`[payout.failed] handler error: ${(err as Error).message}`);
    }
  }
}
