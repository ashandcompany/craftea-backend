import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { of } from 'rxjs';
import { PaymentsService } from './payments.service';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { StripeService } from './stripe.service';
import { WalletService } from './wallet.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

// Mock uuid to return a predictable value
jest.mock('uuid', () => ({ v4: () => 'mock-uuid-1234' }));

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentsRepo: jest.Mocked<Repository<Payment>>;
  let stripeService: jest.Mocked<StripeService>;
  let walletService: jest.Mocked<WalletService>;
  let httpService: jest.Mocked<HttpService>;

  // Commission : calculateFee(5000) = Math.round(5000*0.05) + 25 = 275
  const mockPayment: Payment = {
    id: 1,
    user_id: 100,
    order_id: 10,
    amount: 50,
    amount_cents: 5000,
    platform_fee_cents: 275,
    artist_amount_cents: 4725,
    artist_stripe_account_id: 'acct_test_artist',
    currency: 'EUR',
    status: PaymentStatus.PENDING,
    wallet_credited: false,
    wallet_credited_at: undefined,
    idempotency_key: 'mock-uuid-1234',
    stripe_payment_intent_id: 'pi_test_123',
    stripe_client_secret: 'pi_test_123_secret',
    stripe_receipt_url: undefined,
    error_detail: undefined,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: StripeService,
          useValue: {
            createPaymentIntent: jest.fn(),
            retrievePaymentIntent: jest.fn(),
            refund: jest.fn(),
            createTransfer: jest.fn(),
          },
        },
        {
          provide: WalletService,
          useValue: {
            credit: jest.fn(),
            creditPending: jest.fn(),
            cancelPending: jest.fn(),
            requestPayout: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
            patch: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(''),
          },
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentsRepo = module.get(getRepositoryToken(Payment)) as jest.Mocked<
      Repository<Payment>
    >;
    stripeService = module.get(StripeService) as jest.Mocked<StripeService>;
    walletService = module.get(WalletService) as jest.Mocked<WalletService>;
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
  });

  describe('createIntent', () => {
    const dto = {
      amount: 50,
      order_id: 10,
      currency: 'EUR',
      artist_stripe_account_id: 'acct_test_artist',
    };

    it('should create a Stripe PaymentIntent and persist payment', async () => {
      stripeService.createPaymentIntent.mockResolvedValue({
        id: 'pi_test_123',
        client_secret: 'pi_test_123_secret',
      } as any);
      paymentsRepo.create.mockReturnValue(mockPayment);
      paymentsRepo.save.mockResolvedValue(mockPayment);

      const result = await service.createIntent(dto, 100);

      // destination charge : applicationFeeAmount + transferDestination ajoutés quand artist account présent
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'EUR',
        idempotencyKey: 'mock-uuid-1234',
        metadata: {
          user_id: '100',
          order_id: '10',
          artistStripeAccountId: 'acct_test_artist',
          platformFee: '275',
        },
        applicationFeeAmount: 275,
        transferDestination: 'acct_test_artist',
      });
      expect(paymentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 100,
          order_id: 10,
          amount: 50,
          amount_cents: 5000,
          platform_fee_cents: 275,
          artist_amount_cents: 4725,
          artist_stripe_account_id: 'acct_test_artist',
          currency: 'EUR',
          status: PaymentStatus.PENDING,
          stripe_payment_intent_id: 'pi_test_123',
          stripe_client_secret: 'pi_test_123_secret',
        }),
      );
      expect(paymentsRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockPayment);
    });

    it('should use default currency EUR when not provided', async () => {
      stripeService.createPaymentIntent.mockResolvedValue({
        id: 'pi_test_456',
        client_secret: 'secret',
      } as any);
      paymentsRepo.create.mockReturnValue(mockPayment);
      paymentsRepo.save.mockResolvedValue(mockPayment);

      await service.createIntent({ amount: 25 }, 100);

      // calculateFee(2500) = Math.round(2500*0.05) + 25 = 150, pas de destination charge sans artist account
      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'EUR',
          metadata: expect.objectContaining({
            artistStripeAccountId: '',
            platformFee: '150',
          }),
        }),
      );
    });
  });

  describe('handleOrderCompleted', () => {
    it('should split and credit multiple artists then mark payment as wallet_credited', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        order_id: 10,
        status: PaymentStatus.COMPLETED,
        wallet_credited: false,
      });
      walletService.credit.mockResolvedValue({} as any);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.handleOrderCompleted({
        orderId: 10,
        artistId: 5,
        amount: 5000,
        splits: [
          { artistId: 5, grossAmount: 3000 },
          { artistId: 7, grossAmount: 2000 },
        ],
      });

      // artist_amount_cents = 4725 ; grossTotal = 5000
      // artiste 5 : floor(4725 * 3000/5000) = 2835
      // artiste 7 : floor(4725 * 2000/5000) = 1890
      expect(walletService.credit).toHaveBeenNthCalledWith(1, 5, 2835, 10);
      expect(walletService.credit).toHaveBeenNthCalledWith(2, 7, 1890, 10);
      expect((result as Payment).wallet_credited).toBe(true);
    });

    it('should skip when payment is not completed', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        order_id: 10,
        status: PaymentStatus.PENDING,
      });

      const result = await service.handleOrderCompleted({
        orderId: 10,
        artistId: 5,
        amount: 5000,
      });

      expect(result).toEqual({ skipped: true });
      expect(walletService.credit).not.toHaveBeenCalled();
    });
  });

  describe('confirm', () => {
    const dto = { payment_intent_id: 'pi_test_123' };

    it('should mark payment as COMPLETED on succeeded intent', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment });
      stripeService.retrievePaymentIntent.mockResolvedValue({
        status: 'succeeded',
        latest_charge: { receipt_url: 'https://receipt.stripe.com/123' },
      } as any);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.confirm(dto, 100);

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(result.stripe_receipt_url).toBe('https://receipt.stripe.com/123');
    });

    it('should mark payment as FAILED on requires_payment_method', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment });
      stripeService.retrievePaymentIntent.mockResolvedValue({
        status: 'requires_payment_method',
      } as any);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.confirm(dto, 100);

      expect(result.status).toBe(PaymentStatus.FAILED);
      expect(result.error_detail).toContain('requires_payment_method');
    });

    it('should mark payment as FAILED on canceled intent', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment });
      stripeService.retrievePaymentIntent.mockResolvedValue({
        status: 'canceled',
      } as any);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.confirm(dto, 100);

      expect(result.status).toBe(PaymentStatus.FAILED);
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      await expect(service.confirm(dto, 100)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('confirmPaymentFromWebhook', () => {
    it('should complete payment by Stripe payment_intent id', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment });
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.confirmPaymentFromWebhook({
        id: 'pi_test_123',
        status: 'succeeded',
        latest_charge: {
          receipt_url: 'https://receipt.stripe.com/from-webhook',
        },
      } as any);

      expect(paymentsRepo.findOne).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: 'pi_test_123' },
        order: { created_at: 'DESC' },
      });
      expect(result?.status).toBe(PaymentStatus.COMPLETED);
      expect(result?.stripe_receipt_url).toBe(
        'https://receipt.stripe.com/from-webhook',
      );
    });

    it('should return null when payment is unknown', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      const result = await service.confirmPaymentFromWebhook({
        id: 'pi_unknown',
      } as any);

      expect(result).toBeNull();
      expect(paymentsRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findByUser', () => {
    it('should return payments for a user', async () => {
      paymentsRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.findByUser(100);

      expect(paymentsRepo.find).toHaveBeenCalledWith({
        where: { user_id: 100 },
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findOne', () => {
    it('should return a payment for the owner', async () => {
      paymentsRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne(1, { id: 100, role: 'user' });

      expect(result).toEqual(mockPayment);
    });

    it('should return a payment for an admin', async () => {
      paymentsRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne(1, { id: 999, role: 'admin' });

      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(999, { id: 100, role: 'user' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner and not admin', async () => {
      paymentsRepo.findOne.mockResolvedValue(mockPayment);

      await expect(
        service.findOne(1, { id: 999, role: 'user' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('findByOrder', () => {
    it('should return payments for an order', async () => {
      paymentsRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.findByOrder(10);

      expect(paymentsRepo.find).toHaveBeenCalledWith({
        where: { order_id: 10 },
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('refund', () => {
    const completedPayment = {
      ...mockPayment,
      status: PaymentStatus.COMPLETED,
    };

    it('should refund a completed payment by owner', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...completedPayment });
      stripeService.refund.mockResolvedValue({} as any);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.refund(
        1,
        { reason: 'Retour' },
        { id: 100, role: 'user' },
      );

      expect(stripeService.refund).toHaveBeenCalledWith(
        expect.objectContaining({
          paymentIntentId: 'pi_test_123',
          reason: 'Retour',
        }),
      );
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('should refund a completed payment by admin', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...completedPayment });
      stripeService.refund.mockResolvedValue({} as any);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.refund(1, {}, { id: 999, role: 'admin' });

      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      await expect(
        service.refund(999, {}, { id: 100, role: 'user' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if not owner and not admin', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...completedPayment });

      await expect(
        service.refund(1, {}, { id: 999, role: 'user' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if payment is not completed', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment }); // status = PENDING

      await expect(
        service.refund(1, {}, { id: 100, role: 'user' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if no stripe_payment_intent_id', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...completedPayment,
        stripe_payment_intent_id: undefined,
      });

      await expect(
        service.refund(1, {}, { id: 100, role: 'user' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if Stripe refund fails', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...completedPayment });
      stripeService.refund.mockRejectedValue(new Error('Stripe error'));

      await expect(
        service.refund(1, {}, { id: 100, role: 'user' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      paymentsRepo.find.mockResolvedValue([mockPayment]);

      const result = await service.findAll();

      expect(paymentsRepo.find).toHaveBeenCalledWith({
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('createIntent — resolveArtistStripeAccount via HTTP', () => {
    it('should resolve artist stripe account from order when not provided in dto', async () => {
      const orderData = { items: [{ shop_id: 42 }] };
      const shopData = { artist_id: 7 };
      const artistData = {
        stripe_account_id: 'acct_resolved',
        stripe_onboarded: true,
      };

      httpService.get
        .mockReturnValueOnce(of({ data: orderData } as any))
        .mockReturnValueOnce(of({ data: shopData } as any))
        .mockReturnValueOnce(of({ data: artistData } as any));

      stripeService.createPaymentIntent.mockResolvedValue({
        id: 'pi_resolved',
        client_secret: 'sec',
      } as any);
      paymentsRepo.create.mockReturnValue(mockPayment);
      paymentsRepo.save.mockResolvedValue(mockPayment);

      await service.createIntent({ amount: 50, order_id: 10 }, 100);

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          transferDestination: 'acct_resolved',
        }),
      );
    });

    it('should proceed without destination charge when resolveArtistStripeAccount returns null', async () => {
      httpService.get.mockReturnValueOnce(of({ data: { items: [] } } as any));

      stripeService.createPaymentIntent.mockResolvedValue({
        id: 'pi_no_dest',
        client_secret: 'sec2',
      } as any);
      paymentsRepo.create.mockReturnValue(mockPayment);
      paymentsRepo.save.mockResolvedValue(mockPayment);

      await service.createIntent({ amount: 50, order_id: 10 }, 100);

      const call = stripeService.createPaymentIntent.mock.calls[0][0];
      expect(call).not.toHaveProperty('transferDestination');
    });

    it('should return null when resolveArtistStripeAccount HTTP call throws', async () => {
      httpService.get.mockReturnValueOnce(of({ data: null } as any));

      stripeService.createPaymentIntent.mockResolvedValue({
        id: 'pi_err',
        client_secret: 'sec3',
      } as any);
      paymentsRepo.create.mockReturnValue(mockPayment);
      paymentsRepo.save.mockResolvedValue(mockPayment);

      await service.createIntent({ amount: 50, order_id: 10 }, 100);

      expect(stripeService.createPaymentIntent).toHaveBeenCalled();
    });
  });

  describe('handleOrderCompleted — edge cases', () => {
    it('should return skipped when no payment found for order', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      const result = await service.handleOrderCompleted({
        orderId: 99,
        artistId: 1,
        amount: 100,
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should return payment immediately if already wallet_credited', async () => {
      const alreadyCredited = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        wallet_credited: true,
      };
      paymentsRepo.findOne.mockResolvedValue(alreadyCredited);

      const result = await service.handleOrderCompleted({
        orderId: 10,
        artistId: 5,
        amount: 5000,
      });

      expect(result).toEqual(alreadyCredited);
      expect(walletService.credit).not.toHaveBeenCalled();
    });

    it('should skip when artistAmountCents is zero', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        wallet_credited: false,
        artist_amount_cents: 0,
      });

      const result = await service.handleOrderCompleted({
        orderId: 10,
        artistId: 5,
        amount: 0,
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should skip when no artist split found and no artistId', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        wallet_credited: false,
      });

      const result = await service.handleOrderCompleted({
        orderId: 10,
        artistId: undefined as any,
        amount: 5000,
        splits: [],
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should credit single artist when only one split provided', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        wallet_credited: false,
      });
      walletService.credit.mockResolvedValue({} as any);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      await service.handleOrderCompleted({
        orderId: 10,
        artistId: 5,
        amount: 5000,
        splits: [{ artistId: 5, grossAmount: 5000 }],
      });

      expect(walletService.credit).toHaveBeenCalledWith(5, 4725, 10);
    });
  });

  describe('handleOrderConfirmed', () => {
    it('should creditPending for each artist split', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });
      walletService.creditPending.mockResolvedValue({} as any);

      const result = await service.handleOrderConfirmed({
        orderId: 10,
        artistId: 5,
        amount: 5000,
        splits: [
          { artistId: 5, grossAmount: 3000 },
          { artistId: 7, grossAmount: 2000 },
        ],
      });

      expect(walletService.creditPending).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true });
    });

    it('should return skipped when payment not found', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      const result = await service.handleOrderConfirmed({
        orderId: 99,
        artistId: 1,
        amount: 100,
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should return skipped when payment is not completed', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.PENDING,
      });

      const result = await service.handleOrderConfirmed({
        orderId: 10,
        artistId: 5,
        amount: 5000,
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should return skipped when artistAmountCents is zero', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        artist_amount_cents: 0,
      });

      const result = await service.handleOrderConfirmed({
        orderId: 10,
        artistId: 5,
        amount: 0,
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should return skipped when no credits computed', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });

      const result = await service.handleOrderConfirmed({
        orderId: 10,
        artistId: undefined as any,
        amount: 5000,
        splits: [],
      });

      expect(result).toEqual({ skipped: true });
    });
  });

  describe('handleOrderCancelled', () => {
    it('should cancelPending for each artist split', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
      });
      walletService.cancelPending.mockResolvedValue({} as any);

      const result = await service.handleOrderCancelled({
        orderId: 10,
        artistId: 5,
        amount: 5000,
      });

      expect(walletService.cancelPending).toHaveBeenCalledWith(5, 4725, 10);
      expect(result).toEqual({ success: true });
    });

    it('should return skipped when payment not found', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      const result = await service.handleOrderCancelled({
        orderId: 99,
        artistId: 1,
        amount: 100,
      });

      expect(result).toEqual({ skipped: true });
    });

    it('should return skipped when artistAmountCents is zero', async () => {
      paymentsRepo.findOne.mockResolvedValue({
        ...mockPayment,
        artist_amount_cents: 0,
      });

      const result = await service.handleOrderCancelled({
        orderId: 10,
        artistId: 5,
        amount: 0,
      });

      expect(result).toEqual({ skipped: true });
    });
  });

  describe('confirmPaymentFromWebhook — auto-confirm order', () => {
    it('should auto-confirm order via HTTP when payment succeeds with order_id', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment });
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.confirmPaymentFromWebhook({
        id: 'pi_test_123',
        status: 'succeeded',
        latest_charge: null,
      } as any);

      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/api/orders/internal/10/status'),
        { status: 'confirmed' },
        expect.any(Object),
      );
      expect(result?.status).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('handleChargeRefundedFromWebhook', () => {
    it('should return early when charge has no payment_intent', async () => {
      await service.handleChargeRefundedFromWebhook({ id: 'ch_no_pi' } as any);

      expect(paymentsRepo.findOne).not.toHaveBeenCalled();
    });

    it('should handle string payment_intent id', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      await service.handleChargeRefundedFromWebhook({
        id: 'ch_1',
        payment_intent: 'pi_test_123',
      } as any);

      expect(paymentsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripe_payment_intent_id: 'pi_test_123' },
        }),
      );
    });

    it('should return early when no local payment found for PI', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      await service.handleChargeRefundedFromWebhook({
        id: 'ch_2',
        payment_intent: 'pi_unknown',
      } as any);

      expect(paymentsRepo.save).not.toHaveBeenCalled();
    });

    it('should mark payment as REFUNDED and not touch already-refunded payment', async () => {
      const alreadyRefunded = {
        ...mockPayment,
        status: PaymentStatus.REFUNDED,
        wallet_credited: false,
      };
      paymentsRepo.findOne.mockResolvedValue(alreadyRefunded);

      await service.handleChargeRefundedFromWebhook({
        id: 'ch_3',
        payment_intent: 'pi_test_123',
      } as any);

      expect(paymentsRepo.save).not.toHaveBeenCalled();
    });

    it('should mark payment as REFUNDED when status is COMPLETED', async () => {
      const completedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        wallet_credited: false,
      };
      paymentsRepo.findOne.mockResolvedValue(completedPayment);
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      await service.handleChargeRefundedFromWebhook({
        id: 'ch_4',
        payment_intent: 'pi_test_123',
      } as any);

      expect(paymentsRepo.save).toHaveBeenCalled();
    });

    it('should reverse wallet credits when wallet_credited is true and artistId resolves', async () => {
      const creditedPayment = {
        ...mockPayment,
        status: PaymentStatus.COMPLETED,
        wallet_credited: true,
        artist_amount_cents: 4725,
        order_id: 10,
        artist_stripe_account_id: undefined,
      };
      paymentsRepo.findOne.mockResolvedValue(creditedPayment);
      walletService.cancelPending.mockResolvedValue({} as any);

      const orderData = { items: [{ shop_id: 1 }] };
      const shopData = { artist_id: 5 };
      httpService.get
        .mockReturnValueOnce(of({ data: orderData } as any))
        .mockReturnValueOnce(of({ data: shopData } as any));
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      await service.handleChargeRefundedFromWebhook({
        id: 'ch_5',
        payment_intent: 'pi_test_123',
      } as any);

      expect(walletService.cancelPending).toHaveBeenCalledWith(5, 4725, 10);
      expect(creditedPayment.wallet_credited).toBe(false);
    });

    it('should handle payment_intent as an object with id', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      await service.handleChargeRefundedFromWebhook({
        id: 'ch_6',
        payment_intent: { id: 'pi_obj_123' },
      } as any);

      expect(paymentsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stripe_payment_intent_id: 'pi_obj_123' },
        }),
      );
    });
  });
});
