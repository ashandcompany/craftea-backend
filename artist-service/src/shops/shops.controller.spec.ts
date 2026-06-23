import { Test, TestingModule } from '@nestjs/testing';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { ShippingZone } from './entities/shop-shipping-profile.entity';
import { DeliveryTimeUnit } from './entities/shop-shipping-method.entity';

describe('ShopsController', () => {
  let controller: ShopsController;
  let service: jest.Mocked<ShopsService>;

  const mockShop = {
    id: 1,
    artist_id: 1,
    name: 'Test Shop',
    description: 'Test shop description',
    location: 'Test location',
    banner_url: 'banner.jpg',
    logo_url: 'logo.jpg',
    created_at: new Date(),
    updated_at: new Date(),
    artist: {
      id: 1,
      user_id: 100,
      bio: 'Artist bio',
      banner_url: '',
      logo_url: '',
      social_links: '',
      validated: true,
      created_at: new Date(),
      updated_at: new Date(),
      shops: [],
    },
  };

  const mockShippingProfile = {
    id: 1,
    shop_id: 1,
    zone: ShippingZone.FRANCE,
    base_fee: 5,
    additional_item_fee: 1,
    free_shipping_threshold: 50,
    created_at: new Date(),
    updated_at: new Date(),
    shop: mockShop as any,
  };

  const mockShippingMethod = {
    id: 1,
    shop_id: 1,
    name: 'Standard Shipping',
    zones: [ShippingZone.FRANCE, ShippingZone.EUROPE],
    delivery_time_min: 3,
    delivery_time_max: 5,
    delivery_time_unit: DeliveryTimeUnit.DAYS,
    created_at: new Date(),
    updated_at: new Date(),
    shop: mockShop as any,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShopsController],
      providers: [
        {
          provide: ShopsService,
          useValue: {
            findByArtist: jest.fn(),
            findByUserId: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            getShippingProfiles: jest.fn(),
            updateShippingProfiles: jest.fn(),
            getShippingMethods: jest.fn(),
            updateShippingMethods: jest.fn(),
            getShippingBulk: jest.fn(),
            getShippingMethodsBulk: jest.fn(),
            getShippingProfilesBulk: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ShopsController>(ShopsController);
    service = module.get(ShopsService) as jest.Mocked<ShopsService>;
  });

  describe('findByArtist', () => {
    it('should return shops for a specific artist', async () => {
      service.findByArtist.mockResolvedValue([mockShop]);

      const result = await controller.findByArtist(1);

      expect(service.findByArtist).toHaveBeenCalledWith(1);
      expect(result).toEqual([mockShop]);
    });
  });

  describe('findByUser', () => {
    it('should return shops for a specific user', async () => {
      service.findByUserId.mockResolvedValue([mockShop]);

      const result = await controller.findByUser(100);

      expect(service.findByUserId).toHaveBeenCalledWith(100);
      expect(result).toEqual([mockShop]);
    });
  });

  describe('findById', () => {
    it('should return a specific shop', async () => {
      service.findById.mockResolvedValue(mockShop);

      const result = await controller.findById(1);

      expect(service.findById).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockShop);
    });
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

      service.create.mockResolvedValue(mockShop);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.create(mockRequest, dto, {
        banner: [mockFile],
      });

      expect(service.create).toHaveBeenCalledWith(dto, 100, {
        banner: [mockFile],
      });
      expect(result).toEqual(mockShop);
    });

    it('should handle missing files', async () => {
      const dto: CreateShopDto = {
        name: 'New Shop',
        description: 'Description',
        location: 'Location',
      };

      service.create.mockResolvedValue(mockShop);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.create(mockRequest, dto, {});

      expect(service.create).toHaveBeenCalledWith(dto, 100, {});
      expect(result).toEqual(mockShop);
    });
  });

  describe('update', () => {
    it('should update a shop', async () => {
      const dto: UpdateShopDto = {
        name: 'Updated Shop',
        description: 'Updated description',
      };

      const updatedShop = { ...mockShop, ...dto };
      service.update.mockResolvedValue(updatedShop);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.update(1, mockRequest, dto, {});

      expect(service.update).toHaveBeenCalledWith(1, dto, 100, {});
      expect(result).toEqual(updatedShop);
    });
  });

  describe('remove', () => {
    it('should remove a shop', async () => {
      const response = { message: 'Boutique supprimée' };
      service.remove.mockResolvedValue(response);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.remove(1, mockRequest);

      expect(service.remove).toHaveBeenCalledWith(1, 100);
      expect(result).toEqual(response);
    });
  });

  describe('getShipping', () => {
    it('should get shipping profiles for a shop', async () => {
      service.getShippingProfiles.mockResolvedValue([mockShippingProfile]);

      const result = await controller.getShipping(1);

      expect(service.getShippingProfiles).toHaveBeenCalledWith(1);
      expect(result).toEqual([mockShippingProfile]);
    });
  });

  describe('updateShipping', () => {
    it('should update shipping profiles', async () => {
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

      service.updateShippingProfiles.mockResolvedValue([mockShippingProfile]);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.updateShipping(1, dto, mockRequest);

      expect(service.updateShippingProfiles).toHaveBeenCalledWith(1, dto, 100);
      expect(result).toEqual([mockShippingProfile]);
    });
  });

  describe('getShippingMethods', () => {
    it('should get shipping methods for a shop', async () => {
      service.getShippingMethods.mockResolvedValue([mockShippingMethod]);

      const result = await controller.getShippingMethods(1);

      expect(service.getShippingMethods).toHaveBeenCalledWith(1);
      expect(result).toEqual([mockShippingMethod]);
    });
  });

  describe('updateShippingMethods', () => {
    it('should update shipping methods', async () => {
      const dto = {
        methods: [
          {
            name: 'Standard Shipping',
            zones: [ShippingZone.FRANCE],
            delivery_time_min: 3,
            delivery_time_max: 5,
            delivery_time_unit: DeliveryTimeUnit.DAYS,
          },
        ],
      };

      service.updateShippingMethods.mockResolvedValue([mockShippingMethod]);

      const mockRequest = { user: { id: 100 } };
      const result = await controller.updateShippingMethods(1, dto, mockRequest);

      expect(service.updateShippingMethods).toHaveBeenCalledWith(1, dto, 100);
      expect(result).toEqual([mockShippingMethod]);
    });
  });

  describe('getShippingBulk', () => {
    it('should get shipping profiles for bulk shops', async () => {
      const bulkResult = { 1: [mockShippingProfile] };
      service.getShippingProfilesBulk.mockResolvedValue(bulkResult);

      const result = await controller.getShippingBulk('1,2,3');

      expect(service.getShippingProfilesBulk).toHaveBeenCalledWith([1, 2, 3]);
      expect(result).toEqual(bulkResult);
    });

    it('should handle empty ids string', async () => {
      service.getShippingProfilesBulk.mockResolvedValue({});

      const result = await controller.getShippingBulk('');

      expect(service.getShippingProfilesBulk).toHaveBeenCalledWith([]);
      expect(result).toEqual({});
    });
  });

  describe('getShippingMethodsBulk', () => {
    it('should get shipping methods for bulk shops', async () => {
      const bulkResult = { 1: [mockShippingMethod] };
      service.getShippingMethodsBulk.mockResolvedValue(bulkResult);

      const result = await controller.getShippingMethodsBulk('1,2,3');

      expect(service.getShippingMethodsBulk).toHaveBeenCalledWith([1, 2, 3]);
      expect(result).toEqual(bulkResult);
    });
  });
});
