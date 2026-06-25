import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrdersInternalController } from './orders-internal.controller';
import { OrdersService } from './orders.service';
import { OrderStatus } from './entities/order.entity';

describe('OrdersInternalController', () => {
  let controller: OrdersInternalController;
  let service: jest.Mocked<OrdersService>;
  let configService: jest.Mocked<ConfigService>;

  const validToken = 'secret-internal-token';

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
      controllers: [OrdersInternalController],
      providers: [
        {
          provide: OrdersService,
          useValue: {
            findOneInternal: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<OrdersInternalController>(OrdersInternalController);
    service = module.get(OrdersService) as jest.Mocked<OrdersService>;
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('findOne', () => {
    it('should return order when token is valid', async () => {
      configService.get.mockReturnValue(validToken);
      service.findOneInternal.mockResolvedValue(mockOrder as any);

      const result = await controller.findOne(1, validToken);

      expect(service.findOneInternal).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockOrder);
    });

    it('should throw ForbiddenException when token is invalid', async () => {
      configService.get.mockReturnValue(validToken);

      await expect(controller.findOne(1, 'wrong-token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when expected token is empty', async () => {
      configService.get.mockReturnValue('');

      await expect(controller.findOne(1, validToken)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when order does not exist', async () => {
      configService.get.mockReturnValue(validToken);
      service.findOneInternal.mockResolvedValue(null);

      await expect(controller.findOne(1, validToken)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    const dto = { status: OrderStatus.CONFIRMED };

    it('should update status when token is valid', async () => {
      configService.get.mockReturnValue(validToken);
      service.updateStatus.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.CONFIRMED,
      } as any);

      const result = await controller.updateStatus(1, dto, validToken);

      expect(service.updateStatus).toHaveBeenCalledWith(1, dto, {
        id: 0,
        role: 'internal',
      });
      expect(result).toMatchObject({ status: OrderStatus.CONFIRMED });
    });

    it('should throw ForbiddenException when token is invalid', async () => {
      configService.get.mockReturnValue(validToken);

      await expect(
        controller.updateStatus(1, dto, 'bad-token'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when expected token is undefined', async () => {
      configService.get.mockReturnValue(undefined as any);

      await expect(
        controller.updateStatus(1, dto, validToken),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
