import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ArtistsService } from './artists.service';
import { ArtistProfile } from './entities/artist-profile.entity';
import { MinioService } from '../minio/minio.service';
import { ConfigService } from '@nestjs/config';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';

describe('ArtistsService', () => {
  let service: ArtistsService;
  let artistsRepository: jest.Mocked<Repository<ArtistProfile>>;
  let minioService: jest.Mocked<MinioService>;

  const mockArtistProfile: ArtistProfile = {
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
  };

  const mockUserData = {
    id: 100,
    firstname: 'John',
    lastname: 'Doe',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtistsService,
        {
          provide: getRepositoryToken(ArtistProfile),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: MinioService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key, defaultValue) => {
              if (key === 'USER_SERVICE_URL') {
                return 'http://user-service:3001';
              }
              if (key === 'FRONTEND_URL') {
                return 'http://localhost:3000';
              }
              if (key === 'STRIPE_SECRET_KEY') {
                return 'sk_test_unit';
              }
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ArtistsService>(ArtistsService);
    artistsRepository = module.get(getRepositoryToken(ArtistProfile)) as jest.Mocked<Repository<ArtistProfile>>;
    minioService = module.get<MinioService>(MinioService) as jest.Mocked<MinioService>;
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

      artistsRepository.findOne.mockResolvedValue(null);
      minioService.uploadFile.mockResolvedValue('banner-123.jpg');
      artistsRepository.create.mockReturnValue({
        ...mockArtistProfile,
        ...dto,
        banner_url: 'banner-123.jpg',
        logo_url: undefined,
      } as unknown as ArtistProfile);
      artistsRepository.save.mockResolvedValue({
        ...mockArtistProfile,
        bio: dto.bio || mockArtistProfile.bio,
        banner_url: 'banner-123.jpg',
      } as ArtistProfile);

      const result = await service.create(
        dto,
        100,
        { banner: [mockFile] },
      );

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 100 },
      });
      expect(minioService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(artistsRepository.create).toHaveBeenCalled();
      expect(artistsRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw ConflictException if artist profile already exists', async () => {
      const dto: CreateArtistDto = {
        bio: 'Test bio',
      };

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);

      await expect(service.create(dto, 100, {})).rejects.toThrow(
        ConflictException,
      );
    });

    it('should handle missing files gracefully', async () => {
      const dto: CreateArtistDto = {
        bio: 'Test bio',
      };

      artistsRepository.findOne.mockResolvedValue(null);
      artistsRepository.create.mockReturnValue({
        user_id: 100,
        bio: dto.bio,
        banner_url: undefined,
        logo_url: undefined,
      } as any);
      artistsRepository.save.mockResolvedValue({
        ...mockArtistProfile,
        bio: dto.bio || mockArtistProfile.bio,
        banner_url: null,
        logo_url: null,
      } as unknown as ArtistProfile);

      const result = await service.create(dto, 100, {});

      expect(minioService.uploadFile).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('me', () => {
    it('should return the current user artist profile with user data', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUserData),
        } as Response),
      );

      artistsRepository.findOne.mockResolvedValue({
        ...mockArtistProfile,
        shops: [],
      });

      const result = await service.me(100);

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 100 },
        relations: ['shops'],
      });
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual(mockUserData);
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.me(100)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should find an artist profile by id', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUserData),
        } as Response),
      );

      artistsRepository.findOne.mockResolvedValue({
        ...mockArtistProfile,
        shops: [],
      });

      const result = await service.findById(1);

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['shops'],
      });
      expect(result).toHaveProperty('id', 1);
      expect(result).toHaveProperty('user');
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return all validated artist profiles', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUserData),
        } as Response),
      );

      artistsRepository.find.mockResolvedValue([
        { ...mockArtistProfile, shops: [] },
        { ...mockArtistProfile, id: 2, user_id: 101, shops: [] },
      ]);

      const result = await service.findAll();

      expect(artistsRepository.find).toHaveBeenCalledWith({
        where: { validated: true },
        relations: ['shops'],
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('user');
    });

    it('should handle empty profiles list', async () => {
      artistsRepository.find.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update an artist profile', async () => {
      const dto: UpdateArtistDto = {
        bio: 'Updated bio',
      };

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      artistsRepository.save.mockResolvedValue({
        ...mockArtistProfile,
       bio: dto.bio || mockArtistProfile.bio,
      });

      const result = await service.update(100, dto, {});

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 100 },
      });
      expect(artistsRepository.save).toHaveBeenCalled();
      expect(result.bio).toBe(dto.bio);
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

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      minioService.deleteFile.mockResolvedValue(undefined);
      minioService.uploadFile.mockResolvedValue('new-banner-123.jpg');
      artistsRepository.save.mockResolvedValue({
        ...mockArtistProfile,
        bio: dto.bio || mockArtistProfile.bio,
        banner_url: 'new-banner-123.jpg',
      } as ArtistProfile);

      const result = await service.update(100, dto, { banner: [mockFile] });

      expect(minioService.deleteFile).toHaveBeenCalledWith('banner-123.jpg');
      expect(minioService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(result.banner_url).toBe('new-banner-123.jpg');
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      const dto: UpdateArtistDto = {
        bio: 'Updated bio',
      };

      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.update(100, dto, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleValidation', () => {
    it('should toggle validation status', async () => {
      const profile = { ...mockArtistProfile, validated: false };
      artistsRepository.findOne.mockResolvedValue(profile);
      artistsRepository.save.mockResolvedValue({
        ...profile,
        validated: true,
      });

      const result = await service.toggleValidation(1);

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result.validated).toBe(true);
      expect(artistsRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.toggleValidation(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createStripeAccount', () => {
    it('should create a Stripe account and return onboarding url', async () => {
      artistsRepository.findOne.mockResolvedValue({
        ...mockArtistProfile,
        stripe_account_id: null,
      });
      artistsRepository.save.mockResolvedValue({
        ...mockArtistProfile,
        stripe_account_id: 'acct_123',
        stripe_onboarded: false,
      });

      (service as any).stripe = {
        accounts: {
          create: jest.fn().mockResolvedValue({ id: 'acct_123' }),
        },
        accountLinks: {
          create: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.test/onboard' }),
        },
      };

      const result = await service.createStripeAccount(100);

      expect((service as any).stripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        controller: {
          fees: { payer: 'application' },
          losses: { payments: 'application' },
          requirement_collection: 'application',
          stripe_dashboard: { type: 'express' },
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      expect(artistsRepository.save).toHaveBeenCalled();
      expect(result).toEqual({
        url: 'https://connect.stripe.test/onboard',
        stripeAccountId: 'acct_123',
      });
    });

    it('should reuse existing Stripe account and only regenerate onboarding url', async () => {
      artistsRepository.findOne.mockResolvedValue({
        ...mockArtistProfile,
        stripe_account_id: 'acct_existing',
      });

      (service as any).stripe = {
        accounts: {
          create: jest.fn(),
        },
        accountLinks: {
          create: jest.fn().mockResolvedValue({ url: 'https://connect.stripe.test/retry' }),
        },
      };

      const result = await service.createStripeAccount(100);

      expect((service as any).stripe.accounts.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        url: 'https://connect.stripe.test/retry',
        stripeAccountId: 'acct_existing',
      });
    });

    it('should throw NotFoundException when artist profile does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.createStripeAccount(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncStripeOnboardingStatus', () => {
    it('should return disabled status when artist has no Stripe account', async () => {
      artistsRepository.findOne.mockResolvedValue({
        ...mockArtistProfile,
        stripe_account_id: null,
        stripe_onboarded: false,
      });

      const result = await service.syncStripeOnboardingStatus(100);

      expect(result).toEqual({
        stripeAccountId: null,
        stripeOnboarded: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
      });
    });

    it('should sync onboarded status from Stripe account capabilities', async () => {
      artistsRepository.findOne.mockResolvedValue({
        ...mockArtistProfile,
        stripe_account_id: 'acct_123',
        stripe_onboarded: false,
      });
      artistsRepository.save.mockResolvedValue({
        ...mockArtistProfile,
        stripe_account_id: 'acct_123',
        stripe_onboarded: true,
      });

      (service as any).stripe = {
        accounts: {
          retrieve: jest.fn().mockResolvedValue({
            details_submitted: true,
            charges_enabled: true,
            payouts_enabled: true,
          }),
        },
      };

      const result = await service.syncStripeOnboardingStatus(100);

      expect(artistsRepository.save).toHaveBeenCalled();
      expect(result).toEqual({
        stripeAccountId: 'acct_123',
        stripeOnboarded: true,
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
      });
    });

    it('should throw NotFoundException when artist profile does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.syncStripeOnboardingStatus(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('adminGetAll', () => {
    it('should return all artist profiles with shops', async () => {
      const profiles = [
        { ...mockArtistProfile, shops: [] },
        { ...mockArtistProfile, id: 2, shops: [] },
      ];
      artistsRepository.find.mockResolvedValue(profiles);

      const result = await service.adminGetAll();

      expect(artistsRepository.find).toHaveBeenCalledWith({
        relations: ['shops'],
      });
      expect(result).toHaveLength(2);
    });
  });
});
