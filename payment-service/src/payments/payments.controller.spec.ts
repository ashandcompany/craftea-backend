import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './entities/payment.entity';
import { WalletService } from './wallet.service';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProcessedWebhookEvent } from './entities/processed-webhook-event.entity';
import { PaymentEventsPublisher } from '../rabbitmq/payment-events.publisher';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: jest.Mocked<PaymentsService>;

  const mockUserReq = { user: { id: 100, role: 'user' } };
  const mockAdminReq = { user: { id: 1, role: 'admin' } };

  const mockPayment = {
    id: 1,
    user_id: 100,
    order_id: 10,
    amount: 50,
    currency: 'EUR',
    status: PaymentStatus.PENDING,
    amount_cents: 5000,
    platform_fee_cents: 500,
    artist_amount_cents: 4500,
    artist_stripe_account_id: 'acct_test_artist',
    wallet_credited: false,
    idempotency_key: 'uuid-123',
    stripe_payment_intent_id: 'pi_test_123',
    stripe_client_secret: 'pi_test_123_secret',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            createIntent: jest.fn(),
            confirm: jest.fn(),
            findByUser: jest.fn(),
            findByOrder: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            refund: jest.fn(),
            confirmPaymentFromWebhook: jest.fn(),
            handleChargeRefundedFromWebhook: jest.fn(),
          },
        },
        {
          provide: WalletService,
          useValue: {
            requestPayout: jest.fn(),
            getMyWallet: jest.fn(),
            listMyTransactions: jest.fn(),
            listTransactionsByArtist: jest.fn(),
            listAllTransactions: jest.fn(),
            handleTransferFailed: jest.fn(),
            handlePayoutFailed: jest.fn(),
            markArtistStripeReady: jest.fn(),
            markArtistStripeNotReady: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            constructWebhookEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(''),
          },
        },
        {
          provide: PaymentEventsPublisher,
          useValue: {
            publish: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ProcessedWebhookEvent),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get(PaymentsService) as jest.Mocked<PaymentsService>;
  });

  describe('createIntent', () => {
    it('should create a payment intent', async () => {
      const dto = { amount: 50, order_id: 10 };
      service.createIntent.mockResolvedValue(mockPayment as any);

      const result = await controller.createIntent(dto, mockUserReq);

      expect(service.createIntent).toHaveBeenCalledWith(dto, 100);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('confirm', () => {
    it('should confirm a payment', async () => {
      const dto = { payment_intent_id: 'pi_test_123' };
      const confirmed = { ...mockPayment, status: PaymentStatus.COMPLETED };
      service.confirm.mockResolvedValue(confirmed as any);

      const result = await controller.confirm(dto, mockUserReq);

      expect(service.confirm).toHaveBeenCalledWith(dto, 100);
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('findMyPayments', () => {
    it('should return current user payments', async () => {
      service.findByUser.mockResolvedValue([mockPayment] as any);

      const result = await controller.findMyPayments(mockUserReq);

      expect(service.findByUser).toHaveBeenCalledWith(100);
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findByOrder', () => {
    it('should return payments for an order', async () => {
      service.findByOrder.mockResolvedValue([mockPayment] as any);

      const result = await controller.findByOrder(10);

      expect(service.findByOrder).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      service.findAll.mockResolvedValue([mockPayment] as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findOne', () => {
    it('should return a single payment', async () => {
      service.findOne.mockResolvedValue(mockPayment as any);

      const result = await controller.findOne(1, mockUserReq);

      expect(service.findOne).toHaveBeenCalledWith(1, mockUserReq.user);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('refund', () => {
    it('should refund a payment', async () => {
      const dto = { reason: 'Retour produit' };
      const refunded = { ...mockPayment, status: PaymentStatus.REFUNDED };
      service.refund.mockResolvedValue(refunded as any);

      const result = await controller.refund(1, dto, mockUserReq);

      expect(service.refund).toHaveBeenCalledWith(1, dto, mockUserReq.user);
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });
  });

  describe('requestPayout', () => {
    it('should request an artist payout', async () => {
      const walletService = (controller as any).walletService as jest.Mocked<WalletService>;
      walletService.requestPayout.mockResolvedValue({ success: true, transferId: 'tr_123' } as any);

      const result = await controller.requestPayout(
        { amount_cents: 1500 },
        { user: { id: 100, role: 'artist' }, headers: { authorization: 'Bearer token' } },
      );

      expect(walletService.requestPayout).toHaveBeenCalledWith(100, 'Bearer token', 1500);
      expect(result).toEqual({ success: true, transferId: 'tr_123' });
    });
  });

  describe('getMyWallet', () => {
    it('should return wallet for authenticated artist', async () => {
      const walletService = (controller as any).walletService as jest.Mocked<WalletService>;
      const wallet = { artistId: 100, walletBalance: 5000 };
      walletService.getMyWallet.mockResolvedValue(wallet as any);

      const result = await controller.getMyWallet({ headers: { authorization: 'Bearer token' } });

      expect(walletService.getMyWallet).toHaveBeenCalledWith('Bearer token');
      expect(result).toEqual(wallet);
    });
  });

  describe('getMyWalletTransactions', () => {
    it('should return transactions for authenticated artist', async () => {
      const walletService = (controller as any).walletService as jest.Mocked<WalletService>;
      walletService.listMyTransactions.mockResolvedValue([]);

      const result = await controller.getMyWalletTransactions({ headers: { authorization: 'Bearer token' } });

      expect(walletService.listMyTransactions).toHaveBeenCalledWith('Bearer token');
      expect(result).toEqual([]);
    });
  });

  describe('getAdminWalletTransactions', () => {
    it('should list transactions for a specific artist when artist_id is provided', async () => {
      const walletService = (controller as any).walletService as jest.Mocked<WalletService>;
      walletService.listTransactionsByArtist.mockResolvedValue([]);

      const result = await controller.getAdminWalletTransactions('5');

      expect(walletService.listTransactionsByArtist).toHaveBeenCalledWith(5);
      expect(result).toEqual([]);
    });

    it('should list all transactions when artist_id is not provided', async () => {
      const walletService = (controller as any).walletService as jest.Mocked<WalletService>;
      walletService.listAllTransactions.mockResolvedValue([]);

      const result = await controller.getAdminWalletTransactions(undefined);

      expect(walletService.listAllTransactions).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('handleWebhook', () => {
    let stripeService: jest.Mocked<StripeService>;
    let paymentsServiceMock: jest.Mocked<PaymentsService>;
    let walletServiceMock: jest.Mocked<WalletService>;
    let webhookEventRepo: any;
    let eventsPublisher: jest.Mocked<PaymentEventsPublisher>;

    beforeEach(() => {
      stripeService = (controller as any).stripeService as jest.Mocked<StripeService>;
      paymentsServiceMock = (controller as any).paymentsService as jest.Mocked<PaymentsService>;
      walletServiceMock = (controller as any).walletService as jest.Mocked<WalletService>;
      webhookEventRepo = (controller as any).webhookEventRepo;
      eventsPublisher = (controller as any).eventsPublisher as jest.Mocked<PaymentEventsPublisher>;
    });

    const makeReq = (rawBody: Buffer | null = Buffer.from('{}')) =>
      ({ rawBody } as any);

    it('should throw BadRequestException when signature is missing', async () => {
      await expect(
        controller.handleWebhook(makeReq(), undefined as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when rawBody is missing', async () => {
      await expect(
        controller.handleWebhook(makeReq(null), 'sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when constructWebhookEvent throws', async () => {
      stripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        controller.handleWebhook(makeReq(), 'bad-sig'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return received:true without processing when event already processed', async () => {
      const mockEvent = { id: 'evt_dup', type: 'payment_intent.succeeded' };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue({ stripe_event_id: 'evt_dup' });

      const result = await controller.handleWebhook(makeReq(), 'sig');

      expect(result).toEqual({ received: true });
      expect(paymentsServiceMock.confirmPaymentFromWebhook).not.toHaveBeenCalled();
    });

    it('should dispatch payment_intent.succeeded to confirmPaymentFromWebhook', async () => {
      const mockEvent = { id: 'evt_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});
      paymentsServiceMock.confirmPaymentFromWebhook.mockResolvedValue(null);

      const result = await controller.handleWebhook(makeReq(), 'sig');

      expect(paymentsServiceMock.confirmPaymentFromWebhook).toHaveBeenCalledWith({ id: 'pi_1' });
      expect(result).toEqual({ received: true });
    });

    it('should dispatch charge.refunded to handleChargeRefundedFromWebhook', async () => {
      const mockEvent = { id: 'evt_2', type: 'charge.refunded', data: { object: { id: 'ch_1' } } };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});
      paymentsServiceMock.handleChargeRefundedFromWebhook.mockResolvedValue(undefined);

      await controller.handleWebhook(makeReq(), 'sig');

      expect(paymentsServiceMock.handleChargeRefundedFromWebhook).toHaveBeenCalledWith({ id: 'ch_1' });
    });

    it('should dispatch transfer.failed to walletService.handleTransferFailed', async () => {
      const mockEvent = { id: 'evt_3', type: 'transfer.failed', data: { object: { id: 'tr_1' } } };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});
      walletServiceMock.handleTransferFailed.mockResolvedValue({} as any);

      await controller.handleWebhook(makeReq(), 'sig');

      expect(walletServiceMock.handleTransferFailed).toHaveBeenCalledWith({ id: 'tr_1' });
    });

    it('should dispatch account.updated with charges+payouts enabled to markArtistStripeReady', async () => {
      const mockEvent = {
        id: 'evt_4',
        type: 'account.updated',
        data: { object: { id: 'acct_1', charges_enabled: true, payouts_enabled: true } },
      };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});
      walletServiceMock.markArtistStripeReady.mockResolvedValue(undefined);

      await controller.handleWebhook(makeReq(), 'sig');

      expect(walletServiceMock.markArtistStripeReady).toHaveBeenCalledWith('acct_1');
    });

    it('should dispatch account.updated with disabled payouts to markArtistStripeNotReady', async () => {
      const mockEvent = {
        id: 'evt_5',
        type: 'account.updated',
        data: { object: { id: 'acct_2', charges_enabled: false, payouts_enabled: false } },
      };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});
      walletServiceMock.markArtistStripeNotReady.mockResolvedValue(undefined);

      await controller.handleWebhook(makeReq(), 'sig');

      expect(walletServiceMock.markArtistStripeNotReady).toHaveBeenCalledWith('acct_2');
    });

    it('should dispatch payout.failed to walletService.handlePayoutFailed', async () => {
      const mockEvent = {
        id: 'evt_6',
        type: 'payout.failed',
        account: 'acct_3',
        data: { object: { id: 'po_1', amount: 3000, currency: 'eur' } },
      };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});
      walletServiceMock.handlePayoutFailed.mockResolvedValue({} as any);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: jest.fn(),
      });

      await controller.handleWebhook(makeReq(), 'sig');

      expect(walletServiceMock.handlePayoutFailed).toHaveBeenCalledWith({ id: 'po_1', amount: 3000, currency: 'eur' });
    });

    it('should dispatch payout.paid and publish event when artist found', async () => {
      const mockEvent = {
        id: 'evt_7',
        type: 'payout.paid',
        account: 'acct_artist',
        data: { object: { id: 'po_2', amount: 5000, currency: 'eur' } },
      };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ email: 'artist@test.com', name: 'Test Artist' }),
      });
      eventsPublisher.publish.mockResolvedValue(undefined);

      await controller.handleWebhook(makeReq(), 'sig');

      expect(eventsPublisher.publish).toHaveBeenCalledWith(
        'payout.succeeded',
        expect.objectContaining({ artistEmail: 'artist@test.com', amount: 5000 }),
      );
    });

    it('should handle unknown event types gracefully', async () => {
      const mockEvent = { id: 'evt_8', type: 'some.unknown.event', data: { object: {} } };
      stripeService.constructWebhookEvent.mockReturnValue(mockEvent as any);
      webhookEventRepo.findOne.mockResolvedValue(null);
      webhookEventRepo.create.mockReturnValue({});
      webhookEventRepo.save.mockResolvedValue({});

      const result = await controller.handleWebhook(makeReq(), 'sig');

      expect(result).toEqual({ received: true });
    });
  });
});
