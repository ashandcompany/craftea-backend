import { Test, TestingModule } from '@nestjs/testing';
import { ArtistsController } from './artists.controller';
import { ArtistsService } from './artists.service';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { ArtistProfile } from './entities/artist-profile.entity';

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
      const result = await controller.create(
        mockRequest,
        dto,
        { banner: [mockFile] },
      );

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

      const updatedResponse = { ...mockArtistResponse, bio: dto.bio } as ArtistProfile;
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
      const result = await controller.update(
        mockRequest,
        dto,
        { banner: [mockFile] },
      );

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
});
