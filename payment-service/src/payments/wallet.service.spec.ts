import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { of } from 'rxjs';
import { WalletService } from './wallet.service';
import {
  WalletTransaction,
  WalletTransactionStatus,
  WalletTransactionType,
} from './entities/wallet-transaction.entity';
import { StripeService } from './stripe.service';

describe('WalletService', () => {
  let service: WalletService;
  let httpService: jest.Mocked<HttpService>;
  let stripeService: jest.Mocked<StripeService>;
  let walletTxRepo: jest.Mocked<Repository<WalletTransaction>>;

  const mockArtistProfile = {
    id: 5,
    stripe_account_id: 'acct_artist',
    stripe_onboarded: true,
    wallet_balance: 10000,
    pending_balance: 2000,
  };

  const mockTx: WalletTransaction = {
    id: 'tx-uuid-1',
    artist_id: 5,
    order_id: 10,
    amount_cents: 2700,
    type: WalletTransactionType.CREDIT,
    status: WalletTransactionStatus.AVAILABLE,
    description: 'Commande #10 validée',
    stripe_transfer_id: undefined,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: HttpService,
          useValue: { get: jest.fn(), patch: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((_key: string, defaultValue?: string) => defaultValue ?? ''),
          },
        },
        {
          provide: StripeService,
          useValue: {
            retrieveConnectedBalance: jest.fn(),
            createPayout: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WalletTransaction),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
    stripeService = module.get(StripeService) as jest.Mocked<StripeService>;
    walletTxRepo = module.get(
      getRepositoryToken(WalletTransaction),
    ) as jest.Mocked<Repository<WalletTransaction>>;
  });

  describe('creditPending', () => {
    it('should return existing transaction and skip HTTP call', async () => {
      const existingTx = { ...mockTx, status: WalletTransactionStatus.PENDING };
      walletTxRepo.findOne.mockResolvedValue(existingTx);

      const result = await service.creditPending(5, 2700, 10);

      expect(result).toEqual(existingTx);
      expect(httpService.patch).not.toHaveBeenCalled();
    });

    it('should create a PENDING transaction and call artist service', async () => {
      walletTxRepo.findOne.mockResolvedValue(null);
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      const pendingTx = { ...mockTx, status: WalletTransactionStatus.PENDING };
      walletTxRepo.create.mockReturnValue(pendingTx as any);
      walletTxRepo.save.mockResolvedValue(pendingTx);

      const result = await service.creditPending(5, 2700, 10);

      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/wallet/add-pending'),
        expect.objectContaining({ amount_cents: 2700 }),
        expect.any(Object),
      );
      expect(walletTxRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(WalletTransactionStatus.PENDING);
    });
  });

  describe('credit', () => {
    it('should return existing AVAILABLE transaction without re-processing', async () => {
      const availableTx = { ...mockTx, status: WalletTransactionStatus.AVAILABLE };
      walletTxRepo.findOne.mockResolvedValue(availableTx);

      const result = await service.credit(5, 2700, 10);

      expect(result).toEqual(availableTx);
      expect(httpService.patch).not.toHaveBeenCalled();
    });

    it('should upgrade an existing PENDING transaction to AVAILABLE', async () => {
      const pendingTx = { ...mockTx, status: WalletTransactionStatus.PENDING };
      walletTxRepo.findOne.mockResolvedValue(pendingTx);
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      walletTxRepo.save.mockImplementation(async (tx: any) => tx);

      const result = await service.credit(5, 2700, 10);

      expect(result.status).toBe(WalletTransactionStatus.AVAILABLE);
    });

    it('should create a new AVAILABLE transaction when none exists', async () => {
      walletTxRepo.findOne.mockResolvedValue(null);
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      walletTxRepo.create.mockReturnValue(mockTx as any);
      walletTxRepo.save.mockResolvedValue(mockTx);

      await service.credit(5, 2700, 10);

      expect(walletTxRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: WalletTransactionStatus.AVAILABLE,
          type: WalletTransactionType.CREDIT,
        }),
      );
    });
  });

  describe('cancelPending', () => {
    it('should skip when no pending transaction exists', async () => {
      walletTxRepo.findOne.mockResolvedValue(null);

      const result = await service.cancelPending(5, 2700, 10);

      expect(result).toEqual({ skipped: true });
      expect(httpService.patch).not.toHaveBeenCalled();
    });

    it('should subtract pending balance and remove the transaction', async () => {
      const pendingTx = { ...mockTx, status: WalletTransactionStatus.PENDING };
      walletTxRepo.findOne.mockResolvedValue(pendingTx);
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      walletTxRepo.remove.mockResolvedValue(pendingTx as any);

      const result = await service.cancelPending(5, 2700, 10);

      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/wallet/subtract-pending'),
        expect.objectContaining({ amount_cents: 2700 }),
        expect.any(Object),
      );
      expect(walletTxRepo.remove).toHaveBeenCalledWith(pendingTx);
      expect(result).toEqual({ cancelled: true, orderId: 10 });
    });
  });

  describe('getMyWallet', () => {
    it('should throw ForbiddenException when auth header is missing', async () => {
      await expect(service.getMyWallet(undefined)).rejects.toThrow(ForbiddenException);
    });

    it('should return wallet snapshot with Stripe balance for an onboarded artist', async () => {
      httpService.get.mockReturnValue(of({ data: mockArtistProfile } as any));
      stripeService.retrieveConnectedBalance.mockResolvedValue({ available: 4500, pending: 800 });

      const result = await service.getMyWallet('Bearer token');

      expect(stripeService.retrieveConnectedBalance).toHaveBeenCalledWith('acct_artist');
      expect(result).toMatchObject({
        artistId: 5,
        stripeAvailable: 4500,
        stripePending: 800,
        walletBalance: 10000,
        pendingBalance: 2000,
      });
    });

    it('should skip Stripe balance fetch when artist is not onboarded', async () => {
      const notOnboarded = { ...mockArtistProfile, stripe_onboarded: false, stripe_account_id: null };
      httpService.get.mockReturnValue(of({ data: notOnboarded } as any));

      const result = await service.getMyWallet('Bearer token');

      expect(stripeService.retrieveConnectedBalance).not.toHaveBeenCalled();
      expect(result.stripeAvailable).toBe(0);
      expect(result.stripePending).toBe(0);
    });

    it('should return zero Stripe balance when Stripe call throws', async () => {
      httpService.get.mockReturnValue(of({ data: mockArtistProfile } as any));
      stripeService.retrieveConnectedBalance.mockRejectedValue(new Error('Stripe error'));

      const result = await service.getMyWallet('Bearer token');

      expect(result.stripeAvailable).toBe(0);
      expect(result.stripePending).toBe(0);
    });
  });

  describe('listMyTransactions', () => {
    it('should throw ForbiddenException when auth header is missing', async () => {
      await expect(service.listMyTransactions(undefined)).rejects.toThrow(ForbiddenException);
    });

    it('should return transactions for the authenticated artist', async () => {
      httpService.get.mockReturnValue(of({ data: mockArtistProfile } as any));
      walletTxRepo.find.mockResolvedValue([mockTx]);

      const result = await service.listMyTransactions('Bearer token');

      expect(walletTxRepo.find).toHaveBeenCalledWith({
        where: { artist_id: 5 },
        order: { created_at: 'DESC' },
        take: 100,
      });
      expect(result).toEqual([mockTx]);
    });
  });

  describe('listTransactionsByArtist', () => {
    it.each([[-1], [0], [NaN]])(
      'should throw BadRequestException for invalid artistId %s',
      async (artistId) => {
        await expect(service.listTransactionsByArtist(artistId)).rejects.toThrow(
          BadRequestException,
        );
      },
    );

    it('should return transactions for a valid artistId', async () => {
      walletTxRepo.find.mockResolvedValue([mockTx]);

      const result = await service.listTransactionsByArtist(5);

      expect(walletTxRepo.find).toHaveBeenCalledWith({
        where: { artist_id: 5 },
        order: { created_at: 'DESC' },
        take: 200,
      });
      expect(result).toEqual([mockTx]);
    });
  });

  describe('requestPayout', () => {
    it('should throw BadRequestException when Stripe account is not configured', async () => {
      const notOnboarded = { ...mockArtistProfile, stripe_onboarded: false, stripe_account_id: null };
      httpService.get.mockReturnValue(of({ data: notOnboarded } as any));

      await expect(service.requestPayout(100, 'Bearer token', 5000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when amount is below 1€ minimum', async () => {
      httpService.get.mockReturnValue(of({ data: mockArtistProfile } as any));
      stripeService.retrieveConnectedBalance.mockResolvedValue({ available: 10000, pending: 0 });

      await expect(service.requestPayout(100, 'Bearer token', 50)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when Stripe balance is insufficient', async () => {
      httpService.get.mockReturnValue(of({ data: mockArtistProfile } as any));
      stripeService.retrieveConnectedBalance.mockResolvedValue({ available: 1000, pending: 0 });

      await expect(service.requestPayout(100, 'Bearer token', 5000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when Stripe balance fetch fails', async () => {
      httpService.get.mockReturnValue(of({ data: mockArtistProfile } as any));
      stripeService.retrieveConnectedBalance.mockRejectedValue(new Error('Stripe unreachable'));

      await expect(service.requestPayout(100, 'Bearer token', 5000)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create payout, debit local wallet, and return success', async () => {
      httpService.get.mockReturnValue(of({ data: mockArtistProfile } as any));
      stripeService.retrieveConnectedBalance.mockResolvedValue({ available: 10000, pending: 0 });
      stripeService.createPayout.mockResolvedValue({ id: 'po_test_123' } as any);
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      walletTxRepo.create.mockReturnValue({ id: 'tx-99', stripe_transfer_id: 'po_test_123' } as any);
      walletTxRepo.save.mockResolvedValue({ id: 'tx-99', stripe_transfer_id: 'po_test_123' } as any);

      const result = await service.requestPayout(100, 'Bearer token', 5000);

      expect(stripeService.createPayout).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'eur',
        stripeAccountId: 'acct_artist',
        description: 'Retrait artiste 5',
      });
      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/wallet/debit'),
        expect.objectContaining({ amount_cents: 5000 }),
        expect.any(Object),
      );
      expect(result).toMatchObject({ success: true, payoutId: 'po_test_123' });
    });
  });

  describe('handlePayoutFailed', () => {
    it('should throw BadRequestException for null input', async () => {
      await expect(service.handlePayoutFailed(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for empty payout id', async () => {
      await expect(service.handlePayoutFailed({ id: '' })).rejects.toThrow(BadRequestException);
    });

    it('should return not_found when no matching transaction exists', async () => {
      walletTxRepo.findOne.mockResolvedValue(null);

      const result = await service.handlePayoutFailed({ id: 'po_unknown' });

      expect(result).toEqual({ recovered: false, reason: 'not_found' });
    });

    it('should return already_handled for a non-PAID transaction', async () => {
      walletTxRepo.findOne.mockResolvedValue({
        ...mockTx,
        type: WalletTransactionType.DEBIT,
        status: WalletTransactionStatus.PENDING,
        stripe_transfer_id: 'po_123',
      });

      const result = await service.handlePayoutFailed({ id: 'po_123' });

      expect(result).toMatchObject({ recovered: false, reason: 'already_handled' });
    });

    it('should restore wallet balance and mark transaction as PENDING on failure', async () => {
      const paidDebitTx = {
        ...mockTx,
        id: 'tx-10',
        artist_id: 5,
        amount_cents: 5000,
        type: WalletTransactionType.DEBIT,
        status: WalletTransactionStatus.PAID,
        stripe_transfer_id: 'po_paid_123',
        description: 'Retrait vers compte bancaire',
      };
      walletTxRepo.findOne.mockResolvedValue(paidDebitTx);
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      walletTxRepo.save.mockImplementation(async (tx: any) => tx);

      const result = await service.handlePayoutFailed({ id: 'po_paid_123' });

      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/5/wallet/credit'),
        expect.objectContaining({ amount_cents: 5000 }),
        expect.any(Object),
      );
      expect(result).toEqual({ recovered: true, transactionId: 'tx-10' });
    });
  });

  describe('handleTransferFailed', () => {
    it('should throw BadRequestException for empty transfer id', async () => {
      await expect(service.handleTransferFailed({ id: '' })).rejects.toThrow(BadRequestException);
    });

    it('should return not_found when no matching transaction exists', async () => {
      walletTxRepo.findOne.mockResolvedValue(null);

      const result = await service.handleTransferFailed({ id: 'tr_unknown' });

      expect(result).toEqual({ recovered: false, reason: 'not_found' });
    });

    it('should return already_handled for a non-PAID transaction', async () => {
      walletTxRepo.findOne.mockResolvedValue({
        ...mockTx,
        type: WalletTransactionType.DEBIT,
        status: WalletTransactionStatus.PENDING,
        stripe_transfer_id: 'tr_123',
      });

      const result = await service.handleTransferFailed({ id: 'tr_123' });

      expect(result).toMatchObject({ recovered: false, reason: 'already_handled' });
    });

    it('should restore wallet balance and mark transaction as PENDING on failure', async () => {
      const paidDebitTx = {
        ...mockTx,
        id: 'tx-20',
        artist_id: 5,
        amount_cents: 4500,
        type: WalletTransactionType.DEBIT,
        status: WalletTransactionStatus.PAID,
        stripe_transfer_id: 'tr_paid_456',
        description: 'Retrait',
      };
      walletTxRepo.findOne.mockResolvedValue(paidDebitTx);
      httpService.patch.mockReturnValue(of({ data: {} } as any));
      walletTxRepo.save.mockImplementation(async (tx: any) => tx);

      const result = await service.handleTransferFailed({ id: 'tr_paid_456' });

      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/5/wallet/credit'),
        expect.objectContaining({ amount_cents: 4500 }),
        expect.any(Object),
      );
      expect(result).toEqual({ recovered: true, transactionId: 'tx-20' });
    });
  });

  describe('markArtistStripeReady', () => {
    it('should call artist service to mark account as ready', async () => {
      httpService.patch.mockReturnValue(of({ data: {} } as any));

      await service.markArtistStripeReady('acct_ready_123');

      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/stripe/mark-ready'),
        { stripe_account_id: 'acct_ready_123' },
        expect.any(Object),
      );
    });
  });

  describe('markArtistStripeNotReady', () => {
    it('should call artist service to mark account as not ready', async () => {
      httpService.patch.mockReturnValue(of({ data: {} } as any));

      await service.markArtistStripeNotReady('acct_not_ready_456');

      expect(httpService.patch).toHaveBeenCalledWith(
        expect.stringContaining('/stripe/mark-not-ready'),
        { stripe_account_id: 'acct_not_ready_456' },
        expect.any(Object),
      );
    });
  });

  describe('listAllTransactions', () => {
    it('should return all transactions', async () => {
      walletTxRepo.find.mockResolvedValue([mockTx]);

      const result = await service.listAllTransactions();

      expect(walletTxRepo.find).toHaveBeenCalledWith({
        order: { created_at: 'DESC' },
        take: 500,
      });
      expect(result).toEqual([mockTx]);
    });
  });
});
