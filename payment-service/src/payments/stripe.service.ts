import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { existsSync, readFileSync } from 'node:fs';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    let secretKey = this.configService
      .get<string>('STRIPE_SECRET_KEY', '')
      .trim();
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
    this.webhookSecret = this.configService
      .get<string>('STRIPE_WEBHOOK_SECRET', '')
      .trim();
  }

  constructWebhookEvent(
    rawBody: Buffer | string,
    signature: string,
  ): Stripe.Event {
    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET manquant');
    }

    if (!this.webhookSecret.startsWith('whsec_')) {
      throw new Error(
        'STRIPE_WEBHOOK_SECRET invalide: utilisez le secret endpoint webhook Stripe (whsec_...), pas une clé API sk_...',
      );
    }

    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }

  /**
   * Create a PaymentIntent — the client will use the returned client_secret
   * to confirm payment via Stripe.js on the frontend.
   *
   * When `transferDestination` is provided, uses Destination Charges:
   * Stripe splits funds automatically — the platform keeps the
   * `applicationFeeAmount` and the rest goes to the connected account.
   */
  async createPaymentIntent(params: {
    amount: number; // in cents
    currency: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
    applicationFeeAmount?: number; // platform commission in cents
    transferDestination?: string; // connected account ID (acct_...)
  }): Promise<Stripe.PaymentIntent> {
    this.logger.log(
      `Creating Stripe PaymentIntent: ${params.amount} ${params.currency} (key: ${params.idempotencyKey})` +
        (params.transferDestination
          ? ` → dest: ${params.transferDestination}`
          : ''),
    );

    const createParams: Stripe.PaymentIntentCreateParams = {
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: params.metadata ?? {},
    };

    // Destination Charge: split funds at payment time
    if (params.transferDestination) {
      createParams.application_fee_amount = params.applicationFeeAmount;
      createParams.transfer_data = {
        destination: params.transferDestination,
      };
    }

    return this.stripe.paymentIntents.create(createParams, {
      idempotencyKey: params.idempotencyKey,
    });
  }

  /** Retrieve an existing PaymentIntent to check its status. */
  async retrievePaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
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
        reason:
          (params.reason as Stripe.RefundCreateParams['reason']) ?? undefined,
      },
      { idempotencyKey: params.idempotencyKey },
    );
  }

  async createTransfer(params: {
    amount: number;
    currency: string;
    destination: string;
    description?: string;
  }): Promise<Stripe.Transfer> {
    return this.stripe.transfers.create({
      amount: params.amount,
      currency: params.currency.toLowerCase(),
      destination: params.destination,
      description: params.description,
    });
  }

  /**
   * Create a payout from the connected account's Stripe balance to their bank.
   * This is used for the Vinted-style wallet: funds sit in the connected
   * account's Stripe balance until the artist requests a payout.
   */
  async createPayout(params: {
    amount: number;
    currency: string;
    stripeAccountId: string;
    description?: string;
  }): Promise<Stripe.Payout> {
    this.logger.log(
      `Creating Stripe Payout: ${params.amount} ${params.currency} → ${params.stripeAccountId}`,
    );

    return this.stripe.payouts.create(
      {
        amount: params.amount,
        currency: params.currency.toLowerCase(),
        description: params.description,
      },
      { stripeAccount: params.stripeAccountId },
    );
  }

  /**
   * Retrieve the Stripe balance for a connected account.
   * Returns available and pending amounts in EUR.
   */
  async retrieveConnectedBalance(stripeAccountId: string): Promise<{
    available: number;
    pending: number;
  }> {
    const balance = await this.stripe.balance.retrieve(
      {},
      { stripeAccount: stripeAccountId },
    );

    const available =
      balance.available.find((b) => b.currency === 'eur')?.amount ?? 0;
    const pending =
      balance.pending.find((b) => b.currency === 'eur')?.amount ?? 0;

    return { available, pending };
  }
}
