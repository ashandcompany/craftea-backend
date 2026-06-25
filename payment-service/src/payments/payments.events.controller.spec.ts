import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentsEventsController } from './payments.events.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsEventsController', () => {
  let controller: PaymentsEventsController;
  let paymentsService: jest.Mocked<PaymentsService>;
  let _configService: jest.Mocked<ConfigService>;

  const VALID_TOKEN = 'secret-service-token';

  const orderDto = { orderId: 10, artistId: 5, amount: 5000 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsEventsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            handleOrderCompleted: jest.fn(),
            handleOrderConfirmed: jest.fn(),
            handleOrderCancelled: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'INTERNAL_SERVICE_TOKEN') return VALID_TOKEN;
              return defaultValue ?? '';
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsEventsController>(PaymentsEventsController);
    paymentsService = module.get(
      PaymentsService,
    ) as jest.Mocked<PaymentsService>;
    _configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('handleOrderCompleted', () => {
    it('should delegate to paymentsService.handleOrderCompleted with valid token', async () => {
      paymentsService.handleOrderCompleted.mockResolvedValue({ skipped: true });

      const result = await controller.handleOrderCompleted(
        orderDto,
        VALID_TOKEN,
      );

      expect(paymentsService.handleOrderCompleted).toHaveBeenCalledWith(
        orderDto,
      );
      expect(result).toEqual({ skipped: true });
    });

    it('should throw ForbiddenException when token is invalid', () => {
      expect(() =>
        controller.handleOrderCompleted(orderDto, 'wrong-token'),
      ).toThrow(ForbiddenException);

      expect(paymentsService.handleOrderCompleted).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when token is missing', () => {
      expect(() =>
        controller.handleOrderCompleted(orderDto, undefined as any),
      ).toThrow(ForbiddenException);
    });
  });

  describe('handleOrderConfirmed', () => {
    it('should delegate to paymentsService.handleOrderConfirmed with valid token', async () => {
      paymentsService.handleOrderConfirmed.mockResolvedValue({ success: true });

      const result = await controller.handleOrderConfirmed(
        orderDto,
        VALID_TOKEN,
      );

      expect(paymentsService.handleOrderConfirmed).toHaveBeenCalledWith(
        orderDto,
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw ForbiddenException when token is invalid', () => {
      expect(() =>
        controller.handleOrderConfirmed(orderDto, 'bad-token'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('handleOrderCancelled', () => {
    it('should delegate to paymentsService.handleOrderCancelled with valid token', async () => {
      paymentsService.handleOrderCancelled.mockResolvedValue({ success: true });

      const result = await controller.handleOrderCancelled(
        orderDto,
        VALID_TOKEN,
      );

      expect(paymentsService.handleOrderCancelled).toHaveBeenCalledWith(
        orderDto,
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw ForbiddenException when token is invalid', () => {
      expect(() => controller.handleOrderCancelled(orderDto, '')).toThrow(
        ForbiddenException,
      );
    });
  });
});
