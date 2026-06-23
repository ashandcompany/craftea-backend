import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import { orderConfirmationTemplate } from './templates/order-confirmation.template.js';
import { stripeKycInviteTemplate } from './templates/stripe-kyc-invite.template.js';
import { stripeKycConfirmedTemplate } from './templates/stripe-kyc-confirmed.template.js';
import { payoutSentTemplate } from './templates/payout-sent.template.js';
import { payoutFailedTemplate } from './templates/payout-failed.template.js';

@Controller('api/notifications/templates')
export class TemplatesController {
  @Get(':name')
  @Header('Content-Type', 'text/html; charset=utf-8')
  getTemplate(@Param('name') name: string): string {
    switch (name) {
      case 'order-confirmation':
        return orderConfirmationTemplate({
          orderNumber: 'CMD-2026-001',
          items: [
            { name: 'Poterie Artisanale', qty: 1, unitPrice: 4999 },
            { name: 'Céramique Peinte à Main', qty: 2, unitPrice: 2499 },
          ],
          total: 9997,
          commissionAmount: 999,
          orderUrl: 'http://localhost:3000/orders/CMD-2026-001',
        });
      case 'kyc-invite':
        return stripeKycInviteTemplate({
          artistName: 'Marie Dupont',
          onboardingUrl: 'https://connect.stripe.com/onboarding/acct_1234567890',
        });
      case 'kyc-confirmed':
        return stripeKycConfirmedTemplate({ artistName: 'Marie Dupont' });
      case 'payout-sent':
        return payoutSentTemplate({ amount: 15000, currency: 'eur', estimatedDays: 3 });
      case 'payout-failed':
        return payoutFailedTemplate({ amount: 10000, currency: 'eur' });
      default:
        throw new NotFoundException(`Template "${name}" not found`);
    }
  }
}
