import { Test, TestingModule } from '@nestjs/testing';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { ArtistProfile } from './entities/artist-profile.entity';
import { ConfigService } from '@nestjs/config';

describe('ArtistsController', () => {
  let controller: ArtistsController;
  let service: jest.Mocked<ArtistsService>;

  const mockArtistResponse = {
    id: 1,
    user_id: 100,
    bio: 'Test bio',
    banner_url: 'banner-123.jpg',
    logo_url: 'logo-123.jpg',
    social_links: 'https://twitter.com/test',
    validated: true,
    stripe_account_id: null,
    stripe_onboarded: false,
    wallet_balance: 0,
    pending_balance: 0,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    shops: [],
    user: {
      id: 100,
      firstname: 'John',
      lastname: 'Doe',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArtistsController],
      providers: [
        {
          provide: ArtistsService,
          useValue: {
            me: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            toggleValidation: jest.fn(),
            adminGetAll: jest.fn(),
            createStripeAccount: jest.fn(),
            syncStripeOnboardingStatus: jest.fn(),
            creditWallet: jest.fn(),
            debitWallet: jest.fn(),
            addPendingBalance: jest.fn(),
            subtractPendingBalance: jest.fn(),
            findByStripeAccountId: jest.fn(),
            markStripeReady: jest.fn(),
            markStripeNotReady: jest.fn(),
            submitVerification: jest.fn(),
            getMyVerification: jest.fn(),
            adminGetPendingVerifications: jest.fn(),
            adminReviewVerification: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback: string) => {
              if (key === 'INTERNAL_SERVICE_TOKEN') return 'test-token';
              return fallback;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<ArtistsController>(ArtistsController);
    service = module.get(ArtistsService) as jest.Mocked<ArtistsService>;
  });

  describe('me', () => {
    it('should return the current user artist profile', async () => {
      service.me.mockResolvedValue(mockArtistResponse);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.me(mockRequest);

      expect(service.me).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockArtistResponse);
    });
  });

  describe('create', () => {
    it('should create a new artist profile', async () => {
      const dto: CreateArtistDto = {
        bio: 'Test bio',
        social_links: 'https://twitter.com/test',
      };

      const mockFile = {
        originalname: 'banner.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 100,
        fieldname: 'banner',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
      } as Express.Multer.File;

      service.create.mockResolvedValue(mockArtistResponse);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.create(mockRequest, dto, {
        banner: [mockFile],
      });

      expect(service.create).toHaveBeenCalledWith(dto, 100, {
        banner: [mockFile],
      });
      expect(result).toEqual(mockArtistResponse);
    });

    it('should handle missing files gracefully', async () => {
      const dto: CreateArtistDto = {
        bio: 'Test bio',
      };

      service.create.mockResolvedValue(mockArtistResponse);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.create(mockRequest, dto, {});

      expect(service.create).toHaveBeenCalledWith(dto, 100, {});
      expect(result).toEqual(mockArtistResponse);
    });
  });

  describe('update', () => {
    it('should update the current user artist profile', async () => {
      const dto: UpdateArtistDto = {
        bio: 'Updated bio',
      };

      const updatedResponse = {
        ...mockArtistResponse,
        bio: dto.bio,
      } as ArtistProfile;
      service.update.mockResolvedValue(updatedResponse);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.update(mockRequest, dto, {});

      expect(service.update).toHaveBeenCalledWith(100, dto, {});
      expect(result).toEqual(updatedResponse);
    });

    it('should handle file uploads during update', async () => {
      const dto: UpdateArtistDto = {
        bio: 'Updated bio',
      };

      const mockFile = {
        originalname: 'new-banner.jpg',
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
        size: 100,
        fieldname: 'banner',
        encoding: '7bit',
        destination: '',
        filename: '',
        path: '',
      } as Express.Multer.File;

      const updatedResponse = {
        ...mockArtistResponse,
        bio: dto.bio,
        banner_url: 'new-banner-123.jpg',
      } as ArtistProfile;
      service.update.mockResolvedValue(updatedResponse);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.update(mockRequest, dto, {
        banner: [mockFile],
      });

      expect(service.update).toHaveBeenCalledWith(100, dto, {
        banner: [mockFile],
      });
      expect(result.banner_url).toBe('new-banner-123.jpg');
    });
  });

  describe('createStripeAccount', () => {
    it('should create or return Stripe onboarding link for current artist', async () => {
      const stripeResponse = {
        url: 'https://connect.stripe.test/onboard',
        stripeAccountId: 'acct_123',
      };
      service.createStripeAccount.mockResolvedValue(stripeResponse);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.createStripeAccount(mockRequest);

      expect(service.createStripeAccount).toHaveBeenCalledWith(100);
      expect(result).toEqual(stripeResponse);
    });
  });

  describe('stripeStatus', () => {
    it('should return Stripe onboarding status for current artist', async () => {
      const statusResponse = {
        stripeAccountId: 'acct_123',
        stripeOnboarded: true,
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
      };
      service.syncStripeOnboardingStatus.mockResolvedValue(statusResponse);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.stripeStatus(mockRequest);

      expect(service.syncStripeOnboardingStatus).toHaveBeenCalledWith(100);
      expect(result).toEqual(statusResponse);
    });
  });

  describe('findAll', () => {
    it('should return all public artist profiles', async () => {
      const profiles = [
        mockArtistResponse,
        { ...mockArtistResponse, id: 2, user_id: 101 },
      ];
      service.findAll.mockResolvedValue(profiles);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockArtistResponse);
    });

    it('should return empty array when no profiles exist', async () => {
      service.findAll.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should return a specific artist profile', async () => {
      service.findById.mockResolvedValue(mockArtistResponse);

      const result = await controller.findById(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockArtistResponse);
    });
  });

  describe('adminGetAll', () => {
    it('should return all artist profiles for admin', async () => {
      const profiles = [
        { ...mockArtistResponse, validated: false },
        mockArtistResponse,
      ];
      service.adminGetAll.mockResolvedValue(profiles);

      const result = await controller.adminGetAll();

      expect(service.adminGetAll).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('toggleValidation', () => {
    it('should toggle validation for an artist profile', async () => {
      const toggleResponse = { id: 1, validated: true };
      service.toggleValidation.mockResolvedValue(toggleResponse);

      const result = await controller.toggleValidation(1);

      expect(service.toggleValidation).toHaveBeenCalledWith(1);
      expect(result).toEqual(toggleResponse);
    });
  });

  describe('assertInternalToken (via internal endpoints)', () => {
    it('should throw ForbiddenException when token is missing', () => {
      const req = { headers: {} };
      expect(() =>
        controller.internalGetByStripeAccount('acct_123', req),
      ).toThrow('Invalid service token');
    });

    it('should throw ForbiddenException when token is wrong', () => {
      const req = { headers: { 'x-service-token': 'wrong-token' } };
      expect(() =>
        controller.internalGetByStripeAccount('acct_123', req),
      ).toThrow('Invalid service token');
    });
  });

  describe('internalGetByStripeAccount', () => {
    it('should return artist when token is valid', async () => {
      service.findByStripeAccountId.mockResolvedValue(
        mockArtistResponse as any,
      );
      const req = { headers: { 'x-service-token': 'test-token' } };

      const result = await controller.internalGetByStripeAccount(
        'acct_123',
        req,
      );

      expect(service.findByStripeAccountId).toHaveBeenCalledWith('acct_123');
      expect(result).toEqual(mockArtistResponse);
    });
  });

  describe('internalCreditWallet', () => {
    it('should credit wallet when token is valid', async () => {
      service.creditWallet.mockResolvedValue({ wallet_balance: 500 } as any);
      const req = { headers: { 'x-service-token': 'test-token' } };

      const result = await controller.internalCreditWallet(
        1,
        { amount_cents: 500 },
        req,
      );

      expect(service.creditWallet).toHaveBeenCalledWith(1, 500);
      expect(result).toEqual({ wallet_balance: 500 });
    });
  });

  describe('internalDebitWallet', () => {
    it('should debit wallet when token is valid', async () => {
      service.debitWallet.mockResolvedValue({ wallet_balance: 0 } as any);
      const req = { headers: { 'x-service-token': 'test-token' } };

      const result = await controller.internalDebitWallet(
        1,
        { amount_cents: 500 },
        req,
      );

      expect(service.debitWallet).toHaveBeenCalledWith(1, 500);
      expect(result).toEqual({ wallet_balance: 0 });
    });
  });

  describe('internalAddPendingBalance', () => {
    it('should add pending balance when token is valid', async () => {
      service.addPendingBalance.mockResolvedValue({
        pending_balance: 200,
      } as any);
      const req = { headers: { 'x-service-token': 'test-token' } };

      const result = await controller.internalAddPendingBalance(
        1,
        { amount_cents: 200 },
        req,
      );

      expect(service.addPendingBalance).toHaveBeenCalledWith(1, 200);
      expect(result).toEqual({ pending_balance: 200 });
    });
  });

  describe('internalSubtractPendingBalance', () => {
    it('should subtract pending balance when token is valid', async () => {
      service.subtractPendingBalance.mockResolvedValue({
        pending_balance: 0,
      } as any);
      const req = { headers: { 'x-service-token': 'test-token' } };

      const result = await controller.internalSubtractPendingBalance(
        1,
        { amount_cents: 200 },
        req,
      );

      expect(service.subtractPendingBalance).toHaveBeenCalledWith(1, 200);
      expect(result).toEqual({ pending_balance: 0 });
    });
  });

  describe('internalMarkStripeReady', () => {
    it('should mark stripe ready when token is valid', async () => {
      service.markStripeReady.mockResolvedValue({
        stripe_onboarded: true,
      } as any);
      const req = { headers: { 'x-service-token': 'test-token' } };

      const result = await controller.internalMarkStripeReady(
        { stripe_account_id: 'acct_123' },
        req,
      );

      expect(service.markStripeReady).toHaveBeenCalledWith('acct_123');
      expect(result).toEqual({ stripe_onboarded: true });
    });
  });

  describe('internalMarkStripeNotReady', () => {
    it('should mark stripe not ready when token is valid', async () => {
      service.markStripeNotReady.mockResolvedValue({
        stripe_onboarded: false,
      } as any);
      const req = { headers: { 'x-service-token': 'test-token' } };

      const result = await controller.internalMarkStripeNotReady(
        { stripe_account_id: 'acct_123' },
        req,
      );

      expect(service.markStripeNotReady).toHaveBeenCalledWith('acct_123');
      expect(result).toEqual({ stripe_onboarded: false });
    });
  });

  describe('submitVerification', () => {
    it('should submit verification for current artist', async () => {
      const verificationResult = { id: 1, status: 'pending' };
      service.submitVerification.mockResolvedValue(verificationResult as any);
      const req = { user: { id: 100 } };
      const files: Express.Multer.File[] = [];
      const dto = { description: 'My products', names: ['product1'] };

      const result = await controller.submitVerification(
        req,
        files,
        dto as any,
      );

      expect(service.submitVerification).toHaveBeenCalledWith(
        100,
        [],
        'My products',
        ['product1'],
      );
      expect(result).toEqual(verificationResult);
    });
  });

  describe('getMyVerification', () => {
    it('should get verification for current artist', async () => {
      const verification = { id: 1, status: 'pending' };
      service.getMyVerification.mockResolvedValue(verification as any);
      const req = { user: { id: 100 } };

      const result = await controller.getMyVerification(req);

      expect(service.getMyVerification).toHaveBeenCalledWith(100);
      expect(result).toEqual(verification);
    });
  });

  describe('adminGetPendingVerifications', () => {
    it('should return all pending verifications for admin', async () => {
      const verifications = [{ id: 1 }, { id: 2 }];
      service.adminGetPendingVerifications.mockResolvedValue(
        verifications as any,
      );

      const result = await controller.adminGetPendingVerifications();

      expect(service.adminGetPendingVerifications).toHaveBeenCalled();
      expect(result).toEqual(verifications);
    });
  });

  describe('adminReviewVerification', () => {
    it('should review a verification for admin', async () => {
      const reviewResult = { id: 1, status: 'approved' };
      service.adminReviewVerification.mockResolvedValue(reviewResult as any);
      const dto = { decision: 'approved', comment: 'Looks good' };

      const result = await controller.adminReviewVerification(1, dto as any);

      expect(service.adminReviewVerification).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(reviewResult);
    });
  });
});
