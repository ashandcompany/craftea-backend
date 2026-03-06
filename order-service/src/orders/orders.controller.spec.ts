import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

describe('OrdersController', () => {
  let controller: OrdersController;
  let service: jest.Mocked<OrdersService>;

  const mockUserReq = { user: { id: 100, role: 'user' } };
  const mockAdminReq = { user: { id: 1, role: 'admin' } };
  const mockArtistReq = { user: { id: 50, role: 'artist' } };

  const mockOrder = {
    id: 1,
    user_id: 100,
    status: OrderStatus.PENDING,
    total: 50,
    shipping_total: 0,
    shipping_zone: 'france',
    created_at: new Date(),
    updated_at: new Date(),
    items: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            create: jest.fn(),
            findByUser: jest.fn(),
            findByArtist: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    service = module.get(OrdersService) as jest.Mocked<OrdersService>;
  });

  describe('create', () => {
    it('should create an order', async () => {
      const dto = { items: [{ product_id: 10, quantity: 2, price: 25 }] };
      service.create.mockResolvedValue(mockOrder as any);

      const result = await controller.create(dto, mockUserReq);

      expect(service.create).toHaveBeenCalledWith(dto, 100);
      expect(result).toEqual(mockOrder);
    });
  });

  describe('findMyOrders', () => {
    it('should return current user orders', async () => {
      service.findByUser.mockResolvedValue([mockOrder] as any);

      const result = await controller.findMyOrders(mockUserReq);

      expect(service.findByUser).toHaveBeenCalledWith(100);
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findArtistOrders', () => {
    it('should return artist orders', async () => {
      service.findByArtist.mockResolvedValue([mockOrder] as any);

      const result = await controller.findArtistOrders(mockArtistReq);

      expect(service.findByArtist).toHaveBeenCalledWith(50);
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findAll', () => {
    it('should return all orders', async () => {
      service.findAll.mockResolvedValue([mockOrder] as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockOrder]);
    });
  });

  describe('findOne', () => {
    it('should return a single order', async () => {
      service.findOne.mockResolvedValue(mockOrder as any);

      const result = await controller.findOne(1, mockUserReq);

      expect(service.findOne).toHaveBeenCalledWith(1, mockUserReq.user);
      expect(result).toEqual(mockOrder);
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const dto = { status: OrderStatus.CONFIRMED };
      const updated = { ...mockOrder, status: OrderStatus.CONFIRMED };
      service.updateStatus.mockResolvedValue(updated as any);

      const result = await controller.updateStatus(1, dto, mockAdminReq);

      expect(service.updateStatus).toHaveBeenCalledWith(1, dto, mockAdminReq.user);
      expect(result.status).toBe(OrderStatus.CONFIRMED);
    });
  });
});
