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
import { OrderEventsPublisher } from '../rabbitmq/order-events.publisher';
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
  let orderEventsPublisher: jest.Mocked<OrderEventsPublisher>;

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
        {
          provide: OrderEventsPublisher,
          useValue: {
            publish: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    ordersRepo = module.get(getRepositoryToken(Order)) as jest.Mocked<Repository<Order>>;
    itemsRepo = module.get(getRepositoryToken(OrderItem)) as jest.Mocked<Repository<OrderItem>>;
    httpService = module.get(HttpService) as jest.Mocked<HttpService>;
    orderEventsPublisher = module.get(OrderEventsPublisher) as jest.Mocked<OrderEventsPublisher>;
  });

  describe('create', () => {
    const dto = {
      items: [{ product_id: 10, quantity: 2, price: 25 }],
      shipping_zone: 'france',
    };

    it('should create an order successfully', async () => {
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null }));
        }
        if (url.includes('/api/shops/shipping/bulk')) {
          return of(axiosResponse({}));
        }
        return of(axiosResponse({}));
      });
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
      httpService.get.mockReturnValue(
        of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null })),
      );
      httpService.patch.mockReturnValue(
        throwError(() => ({
          response: { data: { message: 'Stock insuffisant' } },
        })),
      );

      await expect(service.create(dto, 100)).rejects.toThrow(BadRequestException);
    });

    it('should use product shipping_fee override when present', async () => {
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: 3.5 }));
        }
        if (url.includes('/api/shops/shipping/bulk')) {
          return of(
            axiosResponse({
              5: [
                {
                  zone: 'france',
                  base_fee: 10,
                  additional_item_fee: 2,
                  free_shipping_threshold: null,
                },
              ],
            }),
          );
        }
        return of(axiosResponse({}));
      });
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      itemsRepo.create.mockReturnValue(mockItems[0]);
      const expectedOrder = { ...mockOrder, shipping_total: 7 };
      ordersRepo.create.mockReturnValue(expectedOrder);
      ordersRepo.save.mockResolvedValue(expectedOrder);

      await service.create(dto, 100);

      // shipping_fee 3.5 × quantity 2 = 7
      expect(ordersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ shipping_total: 7 }),
      );
    });

    it('should use shop base_fee when no product override', async () => {
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null }));
        }
        if (url.includes('/api/shops/shipping/bulk')) {
          return of(
            axiosResponse({
              5: [
                {
                  zone: 'france',
                  base_fee: 5,
                  additional_item_fee: 2,
                  free_shipping_threshold: null,
                },
              ],
            }),
          );
        }
        return of(axiosResponse({}));
      });
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      itemsRepo.create.mockReturnValue(mockItems[0]);
      ordersRepo.create.mockReturnValue(mockOrder);
      ordersRepo.save.mockResolvedValue(mockOrder);

      await service.create(dto, 100);

      // qty=2: base_fee(5) for 1st item + additional(2) for 2nd = 7
      expect(ordersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ shipping_total: 7 }),
      );
    });

    it('should apply free shipping when threshold is met', async () => {
      const dtoExpensive = {
        items: [{ product_id: 10, quantity: 2, price: 100 }],
        shipping_zone: 'france',
      };
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null }));
        }
        if (url.includes('/api/shops/shipping/bulk')) {
          return of(
            axiosResponse({
              5: [
                {
                  zone: 'france',
                  base_fee: 10,
                  additional_item_fee: 2,
                  free_shipping_threshold: 100,
                },
              ],
            }),
          );
        }
        return of(axiosResponse({}));
      });
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      itemsRepo.create.mockReturnValue(mockItems[0]);
      const freeOrder = { ...mockOrder, total: 200, shipping_total: 0 };
      ordersRepo.create.mockReturnValue(freeOrder);
      ordersRepo.save.mockResolvedValue(freeOrder);

      await service.create(dtoExpensive, 100);

      // subtotal 200 >= threshold 100 → free shipping
      expect(ordersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ shipping_total: 0 }),
      );
    });

    it('should continue with 0 shipping if shipping profile fetch fails', async () => {
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null }));
        }
        return throwError(() => new Error('Service unavailable'));
      });
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      itemsRepo.create.mockReturnValue(mockItems[0]);
      ordersRepo.create.mockReturnValue(mockOrder);
      ordersRepo.save.mockResolvedValue(mockOrder);

      const result = await service.create(dto, 100);

      expect(result).toEqual(mockOrder);
      expect(ordersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ shipping_total: 0 }),
      );
    });

    it('should rollback partially decremented stock on failure', async () => {
      const dtoMulti = {
        items: [
          { product_id: 10, quantity: 1, price: 25 },
          { product_id: 11, quantity: 1, price: 25 },
        ],
        shipping_zone: 'france',
      };

      let getCount = 0;
      httpService.get.mockImplementation(() => {
        getCount++;
        return of(
          axiosResponse({ id: getCount === 1 ? 10 : 11, shop_id: 5, shipping_fee: null }),
        );
      });

      let patchCount = 0;
      httpService.patch.mockImplementation(() => {
        patchCount++;
        if (patchCount === 1) return of(axiosResponse({ success: true }));
        // Second decrement fails → rollback triggered
        return throwError(() => ({
          response: { data: { message: 'Erreur stock produit 11' } },
        }));
      });

      await expect(service.create(dtoMulti, 100)).rejects.toThrow(BadRequestException);
    });

    it('should create order without shipping_zone (defaults to france)', async () => {
      const dtoNoZone = { items: [{ product_id: 10, quantity: 1, price: 25 }] };
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null }));
        }
        return of(axiosResponse({}));
      });
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      itemsRepo.create.mockReturnValue({ ...mockItems[0], quantity: 1 });
      const zoneOrder = { ...mockOrder, shipping_zone: 'france' };
      ordersRepo.create.mockReturnValue(zoneOrder);
      ordersRepo.save.mockResolvedValue(zoneOrder);

      await service.create(dtoNoZone, 100);

      expect(ordersRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ shipping_zone: 'france' }),
      );
    });

    it('should create order when product has no shop_id', async () => {
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/products/10')) {
          return of(axiosResponse({ id: 10, shipping_fee: null })); // no shop_id
        }
        return of(axiosResponse({}));
      });
      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      itemsRepo.create.mockReturnValue({ ...mockItems[0], shop_id: undefined });
      ordersRepo.create.mockReturnValue(mockOrder);
      ordersRepo.save.mockResolvedValue(mockOrder);

      const result = await service.create(dto, 100);
      expect(result).toBeDefined();
    });

    it('should throw generic BadRequestException if error has no response data', async () => {
      httpService.get.mockReturnValue(
        of(axiosResponse({ id: 10, shop_id: 5, shipping_fee: null })),
      );
      httpService.patch.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.create(dto, 100)).rejects.toThrow(BadRequestException);
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

  describe('findOneInternal', () => {
    it('should return order without ownership check', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);

      const result = await service.findOneInternal(1);

      expect(ordersRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(mockOrder);
    });

    it('should return null when order not found', async () => {
      ordersRepo.findOne.mockResolvedValue(null);

      const result = await service.findOneInternal(999);
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should allow owner to cancel a pending order', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({
        ...pendingOrder,
        status: OrderStatus.CANCELLED,
      });
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

    it('should throw ForbiddenException if artist is not shop owner', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);
      httpService.get.mockReturnValue(of(axiosResponse([])));

      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.CONFIRMED },
          { id: 999, role: 'artist' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if owner tries artist-only status', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);

      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.CONFIRMED },
          { id: 100, role: 'user' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if owner tries status that is not CANCELLED and not in artistOrAdminStatuses', async () => {
      ordersRepo.findOne.mockResolvedValue(mockOrder);

      // PENDING is not in artistOrAdminStatuses and not CANCELLED
      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.PENDING },
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
      httpService.get.mockReturnValue(of(axiosResponse([{ id: 5 }])));

      const result = await service.updateStatus(
        1,
        { status: OrderStatus.CONFIRMED },
        { id: 50, role: 'artist' },
      );

      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });

    it('should emit order-completed event when status changes to DELIVERED', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.DELIVERED });

      httpService.get.mockReturnValue(
        of(axiosResponse({ id: 5, artist_id: 99 })),
      );
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      await service.updateStatus(
        1,
        { status: OrderStatus.DELIVERED },
        { id: 1, role: 'admin' },
      );

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('order-completed'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should NOT emit order-completed when order was already DELIVERED', async () => {
      const deliveredOrder = {
        ...mockOrder,
        status: OrderStatus.DELIVERED,
        items: mockItems,
      };
      ordersRepo.findOne.mockResolvedValue(deliveredOrder);
      ordersRepo.save.mockResolvedValue(deliveredOrder);

      await service.updateStatus(
        1,
        { status: OrderStatus.DELIVERED },
        { id: 1, role: 'admin' },
      );

      expect(httpService.post).not.toHaveBeenCalledWith(
        expect.stringContaining('order-completed'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should emit order-confirmed event when status changes to CONFIRMED', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CONFIRMED });

      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/shops/') && !url.includes('shipping') && !url.includes('user')) {
          return of(axiosResponse({ id: 5, artist_id: 99 }));
        }
        if (url.includes('/api/users/internal')) {
          return of(axiosResponse({ email: 'buyer@test.com' }));
        }
        if (url.includes('/api/products')) {
          return of(axiosResponse({ title: 'Test Product', images: [] }));
        }
        if (url.includes('/api/payments/order')) {
          return of(axiosResponse([]));
        }
        return of(axiosResponse({}));
      });
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      await service.updateStatus(
        1,
        { status: OrderStatus.CONFIRMED },
        { id: 1, role: 'admin' },
      );

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('order-confirmed'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should emit order-cancelled event when cancelled from CONFIRMED status', async () => {
      const confirmedOrder = {
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        items: mockItems,
      };
      ordersRepo.findOne.mockResolvedValue(confirmedOrder);
      ordersRepo.save.mockResolvedValue({ ...confirmedOrder, status: OrderStatus.CANCELLED });

      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/payments/order')) {
          return of(axiosResponse([]));
        }
        if (url.includes('/api/shops/')) {
          return of(axiosResponse({ id: 5, artist_id: 99 }));
        }
        return of(axiosResponse({}));
      });
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      await service.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        { id: 100, role: 'user' },
      );

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('order-cancelled'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should emit order-cancelled when cancelled from PREPARING status', async () => {
      const preparingOrder = {
        ...mockOrder,
        status: OrderStatus.PREPARING,
        items: mockItems,
      };
      ordersRepo.findOne.mockResolvedValue(preparingOrder);
      ordersRepo.save.mockResolvedValue({ ...preparingOrder, status: OrderStatus.CANCELLED });

      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/payments/order')) return of(axiosResponse([]));
        // getArtistShopIds returns an array of shop objects
        if (url.includes('/api/shops/user/')) return of(axiosResponse([{ id: 5 }]));
        // shop detail returns single object with artist_id
        if (url.includes('/api/shops/')) return of(axiosResponse({ id: 5, artist_id: 99 }));
        return of(axiosResponse({}));
      });
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      // Artist who owns the shop cancels
      await service.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        { id: 50, role: 'artist' },
      );

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('order-cancelled'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should NOT emit order-cancelled when cancelled from PENDING status', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CANCELLED });

      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      httpService.get.mockReturnValue(of(axiosResponse([])));

      await service.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        { id: 100, role: 'user' },
      );

      expect(httpService.post).not.toHaveBeenCalledWith(
        expect.stringContaining('order-cancelled'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should skip emit when order has no items with shop_id', async () => {
      const noShopOrder = {
        ...mockOrder,
        items: [{ ...mockItems[0], shop_id: undefined }],
      };
      ordersRepo.findOne.mockResolvedValue(noShopOrder);
      ordersRepo.save.mockResolvedValue({ ...noShopOrder, status: OrderStatus.DELIVERED });

      await service.updateStatus(
        1,
        { status: OrderStatus.DELIVERED },
        { id: 1, role: 'admin' },
      );

      // splits are empty → no POST to payment service
      expect(httpService.post).not.toHaveBeenCalledWith(
        expect.stringContaining('order-completed'),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should handle emitOrderCompleted failure gracefully (best-effort)', async () => {
      const pendingOrder = { ...mockOrder, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.DELIVERED });

      httpService.get.mockReturnValue(of(axiosResponse({ id: 5, artist_id: 99 })));
      httpService.post.mockReturnValue(throwError(() => new Error('Payment down')));

      await expect(
        service.updateStatus(1, { status: OrderStatus.DELIVERED }, { id: 1, role: 'admin' }),
      ).resolves.toBeDefined();
    });

    it('should handle shop GET failure in buildArtistGrossSplits gracefully', async () => {
      const pendingOrder = { ...mockOrder, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.DELIVERED });

      // Shop lookup always fails → splits empty → no POST
      httpService.get.mockReturnValue(throwError(() => new Error('Shop service down')));

      await expect(
        service.updateStatus(1, { status: OrderStatus.DELIVERED }, { id: 1, role: 'admin' }),
      ).resolves.toBeDefined();
    });

    it('should refund completed payment during cancellation', async () => {
      const confirmedOrder = {
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        items: mockItems,
      };
      ordersRepo.findOne.mockResolvedValue(confirmedOrder);
      ordersRepo.save.mockResolvedValue({ ...confirmedOrder, status: OrderStatus.CANCELLED });

      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/payments/order')) {
          return of(axiosResponse([{ id: 'pay_1', status: 'completed' }]));
        }
        if (url.includes('/api/shops/')) {
          return of(axiosResponse({ id: 5, artist_id: 99 }));
        }
        return of(axiosResponse({}));
      });
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      await service.updateStatus(
        1,
        { status: OrderStatus.CANCELLED },
        { id: 100, role: 'user' },
      );

      expect(httpService.post).toHaveBeenCalledWith(
        expect.stringContaining('/refund'),
        expect.any(Object),
        expect.any(Object),
      );
    });

    it('should handle stock restore failure during cancellation (best-effort)', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CANCELLED });

      httpService.patch.mockReturnValue(throwError(() => new Error('Service down')));
      httpService.get.mockReturnValue(of(axiosResponse([])));

      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.CANCELLED },
          { id: 100, role: 'user' },
        ),
      ).resolves.toBeDefined();
    });

    it('should handle payment GET failure during cancellation (best-effort)', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CANCELLED });

      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      httpService.get.mockReturnValue(throwError(() => new Error('Payment service down')));

      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.CANCELLED },
          { id: 100, role: 'user' },
        ),
      ).resolves.toBeDefined();
    });

    it('should publish order.confirmed notification after confirming (fire-and-forget)', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CONFIRMED });

      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/shops/') && !url.includes('shipping') && !url.includes('user')) {
          return of(axiosResponse({ id: 5, artist_id: 99 }));
        }
        if (url.includes('/api/users/internal')) {
          return of(axiosResponse({ email: 'buyer@test.com' }));
        }
        if (url.includes('/api/products')) {
          return of(
            axiosResponse({
              title: 'Test Product',
              images: [{ image_url: 'img.jpg' }],
            }),
          );
        }
        if (url.includes('/api/payments/order')) {
          return of(
            axiosResponse([{ id: 'pay_1', commission_amount: 5 }]),
          );
        }
        return of(axiosResponse({}));
      });
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      await service.updateStatus(
        1,
        { status: OrderStatus.CONFIRMED },
        { id: 1, role: 'admin' },
      );
      // Flush fire-and-forget microtask chain (multiple ticks for nested awaits)
      for (let i = 0; i < 10; i++) await Promise.resolve();

      expect(orderEventsPublisher.publish).toHaveBeenCalledWith(
        'order.confirmed',
        expect.objectContaining({ buyerEmail: 'buyer@test.com' }),
      );
    });

    it('should handle emitOrderConfirmed POST failure gracefully', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CONFIRMED });

      httpService.get.mockReturnValue(
        of(axiosResponse({ id: 5, artist_id: 99 })),
      );
      // POST to order-confirmed fails
      httpService.post.mockReturnValue(throwError(() => new Error('Payment service down')));

      await expect(
        service.updateStatus(1, { status: OrderStatus.CONFIRMED }, { id: 1, role: 'admin' }),
      ).resolves.toBeDefined();
    });

    it('should handle emitOrderCancelled POST failure gracefully', async () => {
      const confirmedOrder = {
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
        items: mockItems,
      };
      ordersRepo.findOne.mockResolvedValue(confirmedOrder);
      ordersRepo.save.mockResolvedValue({ ...confirmedOrder, status: OrderStatus.CANCELLED });

      httpService.patch.mockReturnValue(of(axiosResponse({ success: true })));
      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/payments/order')) return of(axiosResponse([]));
        if (url.includes('/api/shops/')) return of(axiosResponse({ id: 5, artist_id: 99 }));
        return of(axiosResponse({}));
      });
      // POST to order-cancelled fails
      httpService.post.mockReturnValue(throwError(() => new Error('Payment service down')));

      await expect(
        service.updateStatus(
          1,
          { status: OrderStatus.CANCELLED },
          { id: 100, role: 'user' },
        ),
      ).resolves.toBeDefined();
    });

    it('should handle publishOrderConfirmedNotification failure gracefully', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CONFIRMED });

      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/shops/') && !url.includes('shipping') && !url.includes('user')) {
          return of(axiosResponse({ id: 5, artist_id: 99 }));
        }
        // User fetch fails → publishOrderConfirmedNotification outer catch runs
        return throwError(() => new Error('User service down'));
      });
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      await expect(
        service.updateStatus(1, { status: OrderStatus.CONFIRMED }, { id: 1, role: 'admin' }),
      ).resolves.toBeDefined();
    });

    it('should handle product fetch failure in notification enrichment (uses fallback name)', async () => {
      const pendingOrder = { ...mockOrder, status: OrderStatus.PENDING, items: mockItems };
      ordersRepo.findOne.mockResolvedValue(pendingOrder);
      ordersRepo.save.mockResolvedValue({ ...pendingOrder, status: OrderStatus.CONFIRMED });

      httpService.get.mockImplementation((url: string) => {
        if (url.includes('/api/shops/') && !url.includes('shipping') && !url.includes('user')) {
          return of(axiosResponse({ id: 5, artist_id: 99 }));
        }
        if (url.includes('/api/users/internal')) {
          return of(axiosResponse({ email: 'buyer@test.com' }));
        }
        if (url.includes('/api/products')) {
          // Product fetch fails → uses fallback name
          return throwError(() => new Error('Catalog down'));
        }
        if (url.includes('/api/payments/order')) {
          return of(axiosResponse([]));
        }
        return of(axiosResponse({}));
      });
      httpService.post.mockReturnValue(of(axiosResponse({ ok: true })));

      await service.updateStatus(
        1,
        { status: OrderStatus.CONFIRMED },
        { id: 1, role: 'admin' },
      );
      // Flush fire-and-forget microtasks
      for (let i = 0; i < 8; i++) await Promise.resolve();

      expect(orderEventsPublisher.publish).toHaveBeenCalledWith(
        'order.confirmed',
        expect.objectContaining({ buyerEmail: 'buyer@test.com' }),
      );
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

    it('should return empty array if artist shop request fails', async () => {
      httpService.get.mockReturnValue(throwError(() => new Error('Service down')));

      const result = await service.findByArtist(50);

      expect(result).toEqual([]);
    });
  });
});
