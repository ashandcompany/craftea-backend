import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { ShopsService } from './shops.service';
import { Shop } from './entities/shop.entity';
import {
  ShopShippingProfile,
  ShippingZone,
} from './entities/shop-shipping-profile.entity';
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
    shopsRepository = module.get(getRepositoryToken(Shop)) as jest.Mocked<
      Repository<Shop>
    >;
    shippingRepository = module.get(
      getRepositoryToken(ShopShippingProfile),
    ) as jest.Mocked<Repository<ShopShippingProfile>>;
    methodsRepository = module.get(
      getRepositoryToken(ShopShippingMethod),
    ) as jest.Mocked<Repository<ShopShippingMethod>>;
    artistsRepository = module.get(
      getRepositoryToken(ArtistProfile),
    ) as jest.Mocked<Repository<ArtistProfile>>;
    minioService = module.get<MinioService>(
      MinioService,
    ) as jest.Mocked<MinioService>;
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
          zone: ShippingZone.FRANCE,
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

  describe('update with file uploads', () => {
    it('should replace banner and logo when files are provided', async () => {
      const dto = { name: 'Updated' };
      const bannerFile = {
        originalname: 'b.jpg',
        buffer: Buffer.from('b'),
      } as Express.Multer.File;
      const logoFile = {
        originalname: 'l.jpg',
        buffer: Buffer.from('l'),
      } as Express.Multer.File;

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(mockShop);
      minioService.deleteFile.mockResolvedValue(undefined);
      minioService.uploadFile
        .mockResolvedValueOnce('new-banner.jpg')
        .mockResolvedValueOnce('new-logo.jpg');
      shopsRepository.save.mockResolvedValue({
        ...mockShop,
        banner_url: 'new-banner.jpg',
        logo_url: 'new-logo.jpg',
      });

      await service.update(1, dto, 100, {
        banner: [bannerFile],
        logo: [logoFile],
      });

      expect(minioService.deleteFile).toHaveBeenCalledWith('banner.jpg');
      expect(minioService.deleteFile).toHaveBeenCalledWith('logo.jpg');
      expect(minioService.uploadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateShippingProfiles', () => {
    it('should update an existing shipping profile', async () => {
      const existingProfile = {
        id: 1,
        shop_id: 1,
        zone: ShippingZone.FRANCE,
        base_fee: 3,
        additional_item_fee: 0.5,
        free_shipping_threshold: null,
      } as ShopShippingProfile;
      const dto = {
        profiles: [
          {
            zone: ShippingZone.FRANCE,
            base_fee: 5,
            additional_item_fee: 1,
            free_shipping_threshold: 50,
          },
        ],
      };

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(mockShop);
      shippingRepository.findOne.mockResolvedValue(existingProfile);
      shippingRepository.save.mockResolvedValue({
        ...existingProfile,
        base_fee: 5,
      });
      shippingRepository.delete.mockResolvedValue({ affected: 1 } as any);
      shippingRepository.find.mockResolvedValue([existingProfile]);

      const result = await service.updateShippingProfiles(1, dto as any, 100);

      expect(shippingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ zone: ShippingZone.FRANCE, base_fee: 5 }),
      );
      expect(result).toEqual([existingProfile]);
    });

    it('should create a new shipping profile when zone does not exist', async () => {
      const newProfile = {
        id: 2,
        shop_id: 1,
        zone: ShippingZone.EUROPE,
        base_fee: 10,
        additional_item_fee: 2,
        free_shipping_threshold: null,
      } as ShopShippingProfile;
      const dto = {
        profiles: [
          { zone: ShippingZone.EUROPE, base_fee: 10, additional_item_fee: 2 },
        ],
      };

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(mockShop);
      shippingRepository.findOne.mockResolvedValue(null);
      shippingRepository.create.mockReturnValue(newProfile);
      shippingRepository.save.mockResolvedValue(newProfile);
      shippingRepository.delete.mockResolvedValue({ affected: 0 } as any);
      shippingRepository.find.mockResolvedValue([newProfile]);

      const result = await service.updateShippingProfiles(1, dto as any, 100);

      expect(shippingRepository.create).toHaveBeenCalled();
      expect(result).toEqual([newProfile]);
    });

    it('should throw ForbiddenException if artist not found', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateShippingProfiles(1, { profiles: [] } as any, 100),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if shop not found', async () => {
      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateShippingProfiles(1, { profiles: [] } as any, 100),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getShippingProfilesBulk', () => {
    it('should return empty object when given no shop ids', async () => {
      const result = await service.getShippingProfilesBulk([]);
      expect(result).toEqual({});
    });

    it('should return profiles grouped by shop id', async () => {
      const profile1 = {
        id: 1,
        shop_id: 1,
        zone: ShippingZone.FRANCE,
      } as ShopShippingProfile;
      const profile2 = {
        id: 2,
        shop_id: 2,
        zone: ShippingZone.EUROPE,
      } as ShopShippingProfile;
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([profile1, profile2]),
      };
      shippingRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getShippingProfilesBulk([1, 2]);

      expect(result[1]).toEqual([profile1]);
      expect(result[2]).toEqual([profile2]);
    });
  });

  describe('getShippingMethods', () => {
    it('should return shipping methods for a shop', async () => {
      const methods = [
        { id: 1, shop_id: 1, name: 'Standard' } as ShopShippingMethod,
      ];
      shopsRepository.findOne.mockResolvedValue(mockShop);
      methodsRepository.find.mockResolvedValue(methods);

      const result = await service.getShippingMethods(1);

      expect(methodsRepository.find).toHaveBeenCalledWith({
        where: { shop_id: 1 },
        order: { id: 'ASC' },
      });
      expect(result).toEqual(methods);
    });

    it('should throw NotFoundException if shop not found', async () => {
      shopsRepository.findOne.mockResolvedValue(null);

      await expect(service.getShippingMethods(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateShippingMethods', () => {
    it('should create a new shipping method', async () => {
      const newMethod = {
        id: 1,
        shop_id: 1,
        name: 'Standard',
      } as ShopShippingMethod;
      const dto = {
        methods: [
          {
            name: 'Standard',
            zones: [ShippingZone.FRANCE],
            delivery_time_min: 2,
            delivery_time_max: 5,
          },
        ],
      };

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(mockShop);
      methodsRepository.find
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([newMethod]);
      methodsRepository.create.mockReturnValue(newMethod);
      methodsRepository.save.mockResolvedValue(newMethod);
      methodsRepository.remove.mockResolvedValue([] as any);

      const result = await service.updateShippingMethods(1, dto as any, 100);

      expect(methodsRepository.create).toHaveBeenCalled();
      expect(result).toEqual([newMethod]);
    });

    it('should update an existing shipping method', async () => {
      const existing = {
        id: 5,
        shop_id: 1,
        name: 'Rapide',
        zones: [ShippingZone.FRANCE],
        delivery_time_unit: 'days',
      } as ShopShippingMethod;
      const dto = {
        methods: [
          { id: 5, name: 'Rapide Updated', zones: [ShippingZone.FRANCE] },
        ],
      };

      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(mockShop);
      methodsRepository.find
        .mockResolvedValueOnce([existing])
        .mockResolvedValueOnce([existing]);
      methodsRepository.findOne.mockResolvedValue(existing);
      methodsRepository.save.mockResolvedValue({
        ...existing,
        name: 'Rapide Updated',
      });
      methodsRepository.remove.mockResolvedValue([] as any);

      await service.updateShippingMethods(1, dto as any, 100);

      expect(methodsRepository.findOne).toHaveBeenCalled();
      expect(methodsRepository.save).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if artist not found', async () => {
      artistsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateShippingMethods(1, { methods: [] } as any, 100),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if shop not found', async () => {
      artistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      shopsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateShippingMethods(1, { methods: [] } as any, 100),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getShippingMethodsBulk', () => {
    it('should return empty object when given no shop ids', async () => {
      const result = await service.getShippingMethodsBulk([]);
      expect(result).toEqual({});
    });

    it('should return methods grouped by shop id', async () => {
      const method1 = {
        id: 1,
        shop_id: 1,
        name: 'Standard',
      } as ShopShippingMethod;
      const method2 = {
        id: 2,
        shop_id: 2,
        name: 'Express',
      } as ShopShippingMethod;
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([method1, method2]),
      };
      methodsRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getShippingMethodsBulk([1, 2]);

      expect(result[1]).toEqual([method1]);
      expect(result[2]).toEqual([method2]);
    });
  });
});
