import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ShopsService } from './shops.service';
import { Shop } from './entities/shop.entity';
import { ShopShippingProfile, ShippingZone } from './entities/shop-shipping-profile.entity';
import { ShopShippingMethod } from './entities/shop-shipping-method.entity';
import { ArtistProfile } from '../artists/entities/artist-profile.entity';
import { MinioService } from '../minio/minio.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

describe('ShopsService', () => {
  let service: ShopsService;
  let shopsRepository: jest.Mocked<Repository<Shop>>;
  let shippingRepository: jest.Mocked<Repository<ShopShippingProfile>>;
  let methodsRepository: jest.Mocked<Repository<ShopShippingMethod>>;
  let artistsRepository: jest.Mocked<Repository<ArtistProfile>>;
  let minioService: jest.Mocked<MinioService>;

  const mockArtistProfile = {
    id: 1,
    user_id: 100,
    bio: 'Artist bio',
    validated: true,
  } as ArtistProfile;

  const mockShop = {
    id: 1,
    artist_id: 1,
    name: 'Test Shop',
    description: 'Test shop description',
    location: 'Test location',
    banner_url: 'banner.jpg',
    logo_url: 'logo.jpg',
    artist: mockArtistProfile,
    created_at: new Date(),
    updated_at: new Date(),
  } as Shop;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShopsService,
        {
          provide: getRepositoryToken(Shop),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ShopShippingProfile),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ShopShippingMethod),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ArtistProfile),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: MinioService,
          useValue: {
            uploadFile: jest.fn(),
            deleteFile: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ShopsService>(ShopsService);
    shopsRepository = module.get(getRepositoryToken(Shop)) as jest.Mocked<Repository<Shop>>;
    shippingRepository = module.get(getRepositoryToken(ShopShippingProfile)) as jest.Mocked<Repository<ShopShippingProfile>>;
    methodsRepository = module.get(getRepositoryToken(ShopShippingMethod)) as jest.Mocked<Repository<ShopShippingMethod>>;
    artistsRepository = module.get(getRepositoryToken(ArtistProfile)) as jest.Mocked<Repository<ArtistProfile>>;
    minioService = module.get<MinioService>(MinioService) as jest.Mocked<MinioService>;
  });

  describe('create', () => {
    it('should create a new shop', async () => {
      const dto: CreateShopDto = {
        name: 'New Shop',
        description: 'New shop description',
        location: 'New location',
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

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      minioService.uploadFile.mockResolvedValue('banner.jpg');
      shopsRepository.create.mockReturnValue(mockShop);
      shopsRepository.save.mockResolvedValue(mockShop);

      const result = await service.create(dto, 100, { banner: [mockFile] });

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 100 },
      });
      expect(minioService.uploadFile).toHaveBeenCalledWith(mockFile);
      expect(shopsRepository.create).toHaveBeenCalled();
      expect(shopsRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockShop);
    });

    it('should throw BadRequestException if artist profile does not exist', async () => {
      const dto: CreateShopDto = {
        name: 'New Shop',
        description: 'Description',
        location: 'Location',
      };

      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.create(dto, 100, {})).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByArtist', () => {
    it('should find shops by artist id', async () => {
      const shops = [mockShop, { ...mockShop, id: 2, name: 'Another Shop' }];
      shopsRepository.find.mockResolvedValue(shops);

      const result = await service.findByArtist(1);

      expect(shopsRepository.find).toHaveBeenCalledWith({
        where: { artist_id: 1 },
      });
      expect(result).toEqual(shops);
    });
  });

  describe('findByUserId', () => {
    it('should find shops by user id', async () => {
      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.find.mockResolvedValue([mockShop]);

      const result = await service.findByUserId(100);

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 100 },
      });
      expect(result).toEqual([mockShop]);
    });

    it('should return empty array if artist profile does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUserId(100);

      expect(result).toEqual([]);
    });
  });

  describe('findById', () => {
    it('should find a shop by id', async () => {
      shopsRepository.findOne.mockResolvedValue(mockShop);

      const result = await service.findById(1);

      expect(shopsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['artist'],
      });
      expect(result).toEqual(mockShop);
    });

    it('should throw NotFoundException if shop does not exist', async () => {
      shopsRepository.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a shop', async () => {
      const dto: UpdateShopDto = {
        name: 'Updated Shop',
        description: 'Updated description',
        location: 'Updated location',
      };

      const updatedShop = { ...mockShop, ...dto };
      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(mockShop);
      shopsRepository.save.mockResolvedValue(updatedShop);

      const result = await service.update(1, dto, 100, {});

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 100 },
      });
      expect(shopsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1, artist_id: 1 },
      });
      expect(shopsRepository.save).toHaveBeenCalled();
      expect(result.name).toBe(dto.name);
    });

    it('should throw ForbiddenException if artist profile does not exist', async () => {
      const dto: UpdateShopDto = { name: 'Updated' };

      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.update(1, dto, 100, {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if shop does not exist', async () => {
      const dto: UpdateShopDto = { name: 'Updated' };

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(null);

      await expect(service.update(1, dto, 100, {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a shop', async () => {
      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(mockShop);
      minioService.deleteFile.mockResolvedValue(undefined);
      shopsRepository.remove.mockResolvedValue(mockShop);

      const result = await service.remove(1, 100);

      expect(artistsRepository.findOne).toHaveBeenCalledWith({
        where: { user_id: 100 },
      });
      expect(minioService.deleteFile).toHaveBeenCalledTimes(2);
      expect(shopsRepository.remove).toHaveBeenCalledWith(mockShop);
      expect(result.message).toBe('Boutique supprimée');
    });

    it('should throw ForbiddenException if artist profile does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(1, 100)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if shop does not exist', async () => {
      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(1, 100)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getShippingProfiles', () => {
    it('should get shipping profiles for a shop', async () => {
      const profiles = [
        {
          id: 1,
          shop_id: 1,
          zone: ShippingZone.FR,
          base_fee: 5,
          additional_item_fee: 1,
          free_shipping_threshold: 50,
        } as ShopShippingProfile,
      ];

      shopsRepository.findOne.mockResolvedValue(mockShop);
      shippingRepository.find.mockResolvedValue(profiles);

      const result = await service.getShippingProfiles(1);

      expect(shopsRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(shippingRepository.find).toHaveBeenCalledWith({
        where: { shop_id: 1 },
        order: { zone: 'ASC' },
      });
      expect(result).toEqual(profiles);
    });

    it('should throw NotFoundException if shop does not exist', async () => {
      shopsRepository.findOne.mockResolvedValue(null);

      await expect(service.getShippingProfiles(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
