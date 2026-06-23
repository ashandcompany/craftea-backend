import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { AxiosResponse, AxiosHeaders } from 'axios';

function axiosResponse<T>(data: T): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

describe('OrdersService', () => {
  let service: OrdersService;
  let ordersRepo: jest.Mocked<Repository<Order>>;
  let itemsRepo: jest.Mocked<Repository<OrderItem>>;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  const mockItems: OrderItem[] = [
    {
      id: 1,
      order_id: 1,
      product_id: 10,
      shop_id: 5,
      quantity: 2,
      price: 25,
    } as OrderItem,
  ];

  const mockOrder: Order = {
    id: 1,
    user_id: 100,
    status: OrderStatus.PENDING,
    total: 50,
    shipping_total: 0,
    shipping_zone: 'france',
    created_at: new Date(),
    updated_at: new Date(),
    items: mockItems,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            patch: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue: string) => defaultValue),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    ordersRepo = module.get(getRepositoryToken(Order)) as jest.Mocked<Repository<Order>>;
    itemsRepo = module.get(getRepositoryToken(OrderItem)) as jest.Mocked<Repository<OrderItem>>;
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('create', () => {
    const dto = {
      items: [{ product_id: 10, quantity: 2, price: 25 }],
      shipping_zone: 'france',
    };

    it('should create an order successfully', async () => {
      // Product lookup
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null }));
        }
        if (url.includes('/api/shops/shipping/bulk')) {
          return of(axiosResponse({}));
        }
        return of(axiosResponse({}));
      });

      // Stock decrement
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));

      itemsRepo.create.mockReturnValue(mockItems[0]);
      ordersRepo.create.mockReturnValue(mockOrder);
      ordersRepo.save.mockResolvedValue(mockOrder);

      const result = await service.create(dto, 100);

      expect(ordersRepo.create).toHaveBeenCalled();
      expect(ordersRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockOrder);
    });

    it('should throw BadRequestException if items array is empty', async () => {
      await expect(service.create({ items: [] }, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if items is undefined', async () => {
      await expect(
        service.create({ items: undefined as any }, 100),
      ).rejects.toThrow(BadRequestException);
    });

    it('should rollback stock and throw if stock decrement fails', async () => {
      // First call: product lookup succeeds
      httpService.get.mockReturnValue(
        of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null })),
      );

      // Stock decrement fails
      httpService.patch.mockReturnValue(
        throwError(() => ({
          response: { data: { message: 'Stock insuffisant' } },
        })),
      );

      await expect(service.create(dto, 100)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findByUser', () => {
    it('should return orders for a user', async () => {
      ordersRepo.find.mockResolvedValue([mockOrder]);

      const result = await service.findByUser(100);

      expect(ordersRepo.find).toHaveBeenCalledWith({
        where: { user_id: 100 },
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findOne', () => {
    it('should return an order for the owner', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOne(1, { id: 100, role: 'user' });

      expect(ordersRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockOrder);
    });

    it('should return an order for an admin', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOne(1, { id: 999, role: 'admin' });

      expect(result).toEqual(mockOrder);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(999, { id: 100, role: 'user' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner and not admin', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.findOne(1, { id: 999, role: 'user' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('should allow owner to cancel order', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      });

      // Mock cancellation HTTP calls
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      httpService.get.mockReturnValue(of(axiosResponse([])));

      const result = await service.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        { id: 100, role: 'user' },
      );

      expect(result.status).toBe(OrderStatus.CANCELLED);
    });

    it('should throw NotFoundException if order does not exist', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          999,
          { status: OrderStatus.CONFIRMED },
          { id: 100, role: 'admin' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if non-owner/non-admin tries to update', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);
      // getArtistShopIds returns empty → not a shop owner
      httpService.get.mockReturnValue(of(axiosResponse([])));

      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.CONFIRMED },
          { id: 999, role: 'artist' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if owner tries non-cancel status', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.CONFIRMED },
          { id: 100, role: 'user' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to set any status', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);
      ordersRepo.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.SHIPPED,
      });

      const result = await service.updateStatus(
        1,
        { status: OrderStatus.SHIPPED },
        { id: 1, role: 'admin' },
      );

      expect(result.status).toBe(OrderStatus.SHIPPED);
    });

    it('should allow shop owner artist to set confirmed status', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);
      ordersRepo.save.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      });
      // getArtistShopIds returns matching shop
      httpService.get.mockReturnValue(
        of(axiosResponse([{ id: 5 }])),
      );

      const result = await service.updateStatus(
        1,
        { status: OrderStatus.CONFIRMED },
        { id: 50, role: 'artist' },
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      ordersRepo.find.mockResolvedValue([mockOrder]);

      const result = await service.findAll();

      expect(ordersRepo.find).toHaveBeenCalledWith({
        order: { created_at: 'DESC' },
      });
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findByShop', () => {
    it('should return orders for a shop', async () => {
      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockOrder]),
      };
      ordersRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findByShop(5);

      expect(qb.where).toHaveBeenCalledWith('item.shop_id = :shopId', {
        shopId: 5,
      });
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findByArtist', () => {
    it('should return orders for artist shops', async () => {
      httpService.get.mockReturnValue(
        of(axiosResponse([{ id: 5 }, { id: 6 }])),
      );

      const qb = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockOrder]),
      };
      ordersRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.findByArtist(50);

      expect(result).toEqual([mockOrder]);
    });

    it('should return empty array if artist has no shops', async () => {
      httpService.get.mockReturnValue(of(axiosResponse([])));

      const result = await service.findByArtist(50);

      expect(result).toEqual([]);
    });
  });
});
