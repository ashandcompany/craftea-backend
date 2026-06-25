import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;
  let mockStripe: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'STRIPE_SECRET_KEY') return 'sk_test_unit';
              if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test_secret';
              return defaultValue ?? '';
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);

    mockStripe = {
      paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
      refunds: { create: jest.fn() },
      transfers: { create: jest.fn() },
      payouts: { create: jest.fn() },
      balance: { retrieve: jest.fn() },
      webhooks: { constructEvent: jest.fn() },
    };
    (service as any).stripe = mockStripe;
  });

  describe('constructWebhookEvent', () => {
    it('should delegate to stripe.webhooks.constructEvent', () => {
      const rawBody = Buffer.from('{}');
      const signature = 't=123,v1=abc';
      const mockEvent = { type: 'payment_intent.succeeded' };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = service.constructWebhookEvent(rawBody, signature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        rawBody,
        signature,
        'whsec_test_secret',
      );
      expect(result).toEqual(mockEvent);
    });

    it('should throw when webhook secret is missing', () => {
      (service as any).webhookSecret = '';

      expect(() =>
        service.constructWebhookEvent(Buffer.from('{}'), 'sig'),
      ).toThrow('STRIPE_WEBHOOK_SECRET manquant');
    });

    it('should throw when webhook secret does not start with whsec_', () => {
      (service as any).webhookSecret = 'sk_test_wrong_format';

      expect(() =>
        service.constructWebhookEvent(Buffer.from('{}'), 'sig'),
      ).toThrow('STRIPE_WEBHOOK_SECRET invalide');
    });
  });

  describe('createPaymentIntent', () => {
    it('should create a basic PaymentIntent without destination charge', async () => {
      const mockIntent = { id: 'pi_test_123', client_secret: 'secret_123' };
      mockStripe.paymentIntents.create.mockResolvedValue(mockIntent);

      const result = await service.createPaymentIntent({
        amount: 5000,
        currency: 'EUR',
        idempotencyKey: 'key-123',
        metadata: { user_id: '1' },
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        {
          amount: 5000,
          currency: 'eur',
          automatic_payment_methods: { enabled: true },
          metadata: { user_id: '1' },
        },
        { idempotencyKey: 'key-123' },
      );
      expect(result).toEqual(mockIntent);
    });

    it('should add destination charge fields when transferDestination is provided', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_dest_456' });

      await service.createPaymentIntent({
        amount: 10000,
        currency: 'eur',
        idempotencyKey: 'key-456',
        applicationFeeAmount: 525,
        transferDestination: 'acct_artist_123',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          application_fee_amount: 525,
          transfer_data: { destination: 'acct_artist_123' },
        }),
        expect.any(Object),
      );
    });

    it('should lowercase the currency', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_1' });

      await service.createPaymentIntent({
        amount: 1000,
        currency: 'EUR',
        idempotencyKey: 'k1',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'eur' }),
        expect.any(Object),
      );
    });

    it('should use empty metadata when not provided', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_2' });

      await service.createPaymentIntent({
        amount: 1000,
        currency: 'eur',
        idempotencyKey: 'k2',
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: {} }),
        expect.any(Object),
      );
    });

    it('should not add transfer_data when transferDestination is absent', async () => {
      mockStripe.paymentIntents.create.mockResolvedValue({ id: 'pi_3' });

      await service.createPaymentIntent({
        amount: 1000,
        currency: 'eur',
        idempotencyKey: 'k3',
      });

      const [params] = mockStripe.paymentIntents.create.mock.calls[0];
      expect(params).not.toHaveProperty('transfer_data');
      expect(params).not.toHaveProperty('application_fee_amount');
    });
  });

  describe('retrievePaymentIntent', () => {
    it('should retrieve a PaymentIntent by id', async () => {
      const mockIntent = { id: 'pi_retrieve', status: 'succeeded' };
      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockIntent);

      const result = await service.retrievePaymentIntent('pi_retrieve');

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith(
        'pi_retrieve',
      );
      expect(result).toEqual(mockIntent);
    });
  });

  describe('refund', () => {
    it('should create a full refund with no amount or reason', async () => {
      const mockRefund = { id: 're_123', status: 'succeeded' };
      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const result = await service.refund({
        paymentIntentId: 'pi_test_123',
        idempotencyKey: 'refund-key-1',
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        { payment_intent: 'pi_test_123', amount: undefined, reason: undefined },
        { idempotencyKey: 'refund-key-1' },
      );
      expect(result).toEqual(mockRefund);
    });

    it('should create a partial refund with reason', async () => {
      mockStripe.refunds.create.mockResolvedValue({ id: 're_456' });

      await service.refund({
        paymentIntentId: 'pi_test_456',
        amount: 2500,
        reason: 'fraudulent',
        idempotencyKey: 'refund-key-2',
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 2500, reason: 'fraudulent' }),
        expect.any(Object),
      );
    });
  });

  describe('createTransfer', () => {
    it('should create a transfer to a connected account', async () => {
      const mockTransfer = { id: 'tr_123', amount: 4500 };
      mockStripe.transfers.create.mockResolvedValue(mockTransfer);

      const result = await service.createTransfer({
        amount: 4500,
        currency: 'EUR',
        destination: 'acct_artist_123',
        description: 'Paiement artiste',
      });

      expect(mockStripe.transfers.create).toHaveBeenCalledWith({
        amount: 4500,
        currency: 'eur',
        destination: 'acct_artist_123',
        description: 'Paiement artiste',
      });
      expect(result).toEqual(mockTransfer);
    });

    it('should lowercase the currency', async () => {
      mockStripe.transfers.create.mockResolvedValue({ id: 'tr_2' });

      await service.createTransfer({
        amount: 1000,
        currency: 'EUR',
        destination: 'acct_x',
      });

      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'eur' }),
      );
    });
  });

  describe('createPayout', () => {
    it('should create a payout from a connected account with stripeAccount option', async () => {
      const mockPayout = { id: 'po_123', amount: 3000 };
      mockStripe.payouts.create.mockResolvedValue(mockPayout);

      const result = await service.createPayout({
        amount: 3000,
        currency: 'EUR',
        stripeAccountId: 'acct_artist_456',
        description: 'Retrait artiste',
      });

      expect(mockStripe.payouts.create).toHaveBeenCalledWith(
        { amount: 3000, currency: 'eur', description: 'Retrait artiste' },
        { stripeAccount: 'acct_artist_456' },
      );
      expect(result).toEqual(mockPayout);
    });

    it('should lowercase the currency', async () => {
      mockStripe.payouts.create.mockResolvedValue({ id: 'po_2' });

      await service.createPayout({
        amount: 1000,
        currency: 'EUR',
        stripeAccountId: 'acct_y',
      });

      expect(mockStripe.payouts.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'eur' }),
        expect.any(Object),
      );
    });
  });

  describe('retrieveConnectedBalance', () => {
    it('should return EUR available and pending amounts', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [
          { currency: 'usd', amount: 1000 },
          { currency: 'eur', amount: 4500 },
        ],
        pending: [{ currency: 'eur', amount: 800 }],
      });

      const result = await service.retrieveConnectedBalance('acct_test_123');

      expect(mockStripe.balance.retrieve).toHaveBeenCalledWith(
        {},
        { stripeAccount: 'acct_test_123' },
      );
      expect(result).toEqual({ available: 4500, pending: 800 });
    });

    it('should return 0 when EUR currency is absent from the balance', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ currency: 'usd', amount: 1000 }],
        pending: [],
      });

      const result = await service.retrieveConnectedBalance('acct_no_eur');

      expect(result).toEqual({ available: 0, pending: 0 });
    });

    it('should return 0 for pending when only available EUR exists', async () => {
      mockStripe.balance.retrieve.mockResolvedValue({
        available: [{ currency: 'eur', amount: 2000 }],
        pending: [{ currency: 'usd', amount: 500 }],
      });

      const result = await service.retrieveConnectedBalance('acct_partial');

      expect(result).toEqual({ available: 2000, pending: 0 });
    });
  });
});
