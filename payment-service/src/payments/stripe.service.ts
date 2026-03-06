import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { existsSync, readFileSync } from 'node:fs';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    let secretKey = this.configService.get<string>('STRIPE_SECRET_KEY', '').trim();
    if (!secretKey) {
      const secretKeyFile = this.configService.get<string>(
        'STRIPE_SECRET_KEY_FILE',
        '/run/secrets/stripe_secret_key',
      );
      if (secretKeyFile && existsSync(secretKeyFile)) {
        secretKey = readFileSync(secretKeyFile, 'utf8').trim();
      }
    }

    this.stripe = new Stripe(secretKey || 'sk_test_placeholder');
  }

  /**
   * Create a PaymentIntent — the client will use the returned client_secret
   * to confirm payment via Stripe.js on the frontend.
   */
  async createPaymentIntent(params: {
    amount: number; // in cents
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
  }): Promise<Stripe.PaymentIntent> {
    this.logger.log(
      `Creating Stripe PaymentIntent: ${params.amount} ${params.currency} (key: ${params.idempotencyKey})`,
    );

    return this.stripe.paymentIntents.create(
      {
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: params.metadata ?? {},
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  /** Retrieve an existing PaymentIntent to check its status. */
  async retrievePaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }

  /** Create a refund for a PaymentIntent. */
  async refund(params: {
    paymentIntentId: string;
    amount?: number; // partial refund in cents, omit for full
    reason?: string;
    idempotencyKey: string;
  }): Promise<Stripe.Refund> {
    this.logger.log(`Creating Stripe refund for PI: ${params.paymentIntentId}`);

    return this.stripe.refunds.create(
      {
        payment_intent: params.paymentIntentId,
        amount: params.amount,
        reason: (params.reason as Stripe.RefundCreateParams['reason']) ?? undefined,
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }
}
