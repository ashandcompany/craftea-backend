import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { EmailService } from './email.service.js';
import { orderConfirmationTemplate } from './templates/order-confirmation.template.js';
import { stripeKycInviteTemplate } from './templates/stripe-kyc-invite.template.js';
import { stripeKycConfirmedTemplate } from './templates/stripe-kyc-confirmed.template.js';
import { payoutSentTemplate } from './templates/payout-sent.template.js';
import { payoutFailedTemplate } from './templates/payout-failed.template.js';
import { artistVerificationSubmittedTemplate } from './templates/artist-verification-submitted.template.js';
import { artistVerificationApprovedTemplate } from './templates/artist-verification-approved.template.js';
import { artistVerificationRejectedTemplate } from './templates/artist-verification-rejected.template.js';

interface OrderConfirmedPayload {
  buyerEmail: string;
  orderNumber: string;
  items: { name: string; image_url?: string | null; qty: number; unitPrice: number }[];
  shippingTotal?: number;
  total: number;
  commissionAmount?: number;
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
        shippingTotal: payload.shippingTotal,
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

  @EventPattern('artist.verification-submitted')
  async handleArtistVerificationSubmitted(
    @Payload() payload: { artistName: string; artistEmail: string; artistId: number },
  ) {
    this.logger.log(`[artist.verification-submitted] artist=${payload.artistName} id=${payload.artistId}`);
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      this.logger.warn('[artist.verification-submitted] ADMIN_EMAIL not set, skipping notification');
      return;
    }
    try {
      const html = artistVerificationSubmittedTemplate({
        artistName: payload.artistName,
        artistId: payload.artistId,
      });
      await this.email.send(adminEmail, `Nouvelle demande de validation : ${payload.artistName}`, html);
    } catch (err) {
      this.logger.error(`[artist.verification-submitted] handler error: ${(err as Error).message}`);
    }
  }

  @EventPattern('artist.verification-approved')
  async handleArtistVerificationApproved(
    @Payload() payload: { artistName: string; artistEmail: string },
  ) {
    this.logger.log(`[artist.verification-approved] artist=${payload.artistName} to=${payload.artistEmail}`);
    try {
      const html = artistVerificationApprovedTemplate({ artistName: payload.artistName });
      await this.email.send(payload.artistEmail, 'Votre compte artiste Craftea est validé ✓', html);
    } catch (err) {
      this.logger.error(`[artist.verification-approved] handler error: ${(err as Error).message}`);
    }
  }

  @EventPattern('artist.verification-rejected')
  async handleArtistVerificationRejected(
    @Payload() payload: { artistName: string; artistEmail: string; note?: string | null },
  ) {
    this.logger.log(`[artist.verification-rejected] artist=${payload.artistName} to=${payload.artistEmail}`);
    try {
      const html = artistVerificationRejectedTemplate({
        artistName: payload.artistName,
        note: payload.note,
      });
      await this.email.send(payload.artistEmail, 'Votre demande de validation Craftea', html);
    } catch (err) {
      this.logger.error(`[artist.verification-rejected] handler error: ${(err as Error).message}`);
    }
  }
}
