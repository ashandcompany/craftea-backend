import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
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

  const mockPayment: Payment = {
    id: 1,
    user_id: 100,
    order_id: 10,
    amount: 50,
    amount_cents: 5000,
    platform_fee_cents: 500,
    artist_amount_cents: 4500,
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
            requestPayout: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
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
    paymentsRepo = module.get(getRepositoryToken(Payment)) as jest.Mocked<Repository<Payment>>;
    stripeService = module.get(StripeService) as jest.Mocked<StripeService>;
    walletService = module.get(WalletService) as jest.Mocked<WalletService>;
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

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'EUR',
        idempotencyKey: 'mock-uuid-1234',
        metadata: {
          user_id: '100',
          order_id: '10',
          artistStripeAccountId: 'acct_test_artist',
          platformFee: '500',
        },
      });
      expect(paymentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 100,
          order_id: 10,
          amount: 50,
          amount_cents: 5000,
          platform_fee_cents: 500,
          artist_amount_cents: 4500,
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

      expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
        currency: 'EUR',
        metadata: expect.objectContaining({
          artistStripeAccountId: '',
          platformFee: '250',
        }),
      }));
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

      expect(walletService.credit).toHaveBeenNthCalledWith(1, 5, 2700, 10);
      expect(walletService.credit).toHaveBeenNthCalledWith(2, 7, 1800, 10);
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

      await expect(service.confirm(dto, 100)).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirmPaymentFromWebhook', () => {
    it('should complete payment by Stripe payment_intent id', async () => {
      paymentsRepo.findOne.mockResolvedValue({ ...mockPayment });
      paymentsRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.confirmPaymentFromWebhook({
        id: 'pi_test_123',
        status: 'succeeded',
        latest_charge: { receipt_url: 'https://receipt.stripe.com/from-webhook' },
      } as any);

      expect(paymentsRepo.findOne).toHaveBeenCalledWith({
        where: { stripe_payment_intent_id: 'pi_test_123' },
        order: { created_at: 'DESC' },
      });
      expect(result?.status).toBe(PaymentStatus.COMPLETED);
      expect(result?.stripe_receipt_url).toBe('https://receipt.stripe.com/from-webhook');
    });

    it('should return null when payment is unknown', async () => {
      paymentsRepo.findOne.mockResolvedValue(null);

      const result = await service.confirmPaymentFromWebhook({ id: 'pi_unknown' } as any);

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

      await expect(service.findOne(999, { id: 100, role: 'user' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not owner and not admin', async () => {
      paymentsRepo.findOne.mockResolvedValue(mockPayment);

      await expect(service.findOne(1, { id: 999, role: 'user' })).rejects.toThrow(
        ForbiddenException,
      );
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

      const result = await service.refund(1, { reason: 'Retour' }, { id: 100, role: 'user' });

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
});
