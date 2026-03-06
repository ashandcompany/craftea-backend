import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentStatus } from './entities/payment.entity';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let service: jest.Mocked<PaymentsService>;

  const mockUserReq = { user: { id: 100, role: 'user' } };
  const mockAdminReq = { user: { id: 1, role: 'admin' } };

  const mockPayment = {
    id: 1,
    user_id: 100,
    order_id: 10,
    amount: 50,
    currency: 'EUR',
    status: PaymentStatus.PENDING,
    idempotency_key: 'uuid-123',
    stripe_payment_intent_id: 'pi_test_123',
    stripe_client_secret: 'pi_test_123_secret',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        {
          provide: PaymentsService,
          useValue: {
            createIntent: jest.fn(),
            confirm: jest.fn(),
            findByUser: jest.fn(),
            findByOrder: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            refund: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
    service = module.get(PaymentsService) as jest.Mocked<PaymentsService>;
  });

  describe('createIntent', () => {
    it('should create a payment intent', async () => {
      const dto = { amount: 50, order_id: 10 };
      service.createIntent.mockResolvedValue(mockPayment as any);

      const result = await controller.createIntent(dto, mockUserReq);

      expect(service.createIntent).toHaveBeenCalledWith(dto, 100);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('confirm', () => {
    it('should confirm a payment', async () => {
      const dto = { payment_intent_id: 'pi_test_123' };
      const confirmed = { ...mockPayment, status: PaymentStatus.COMPLETED };
      service.confirm.mockResolvedValue(confirmed as any);

      const result = await controller.confirm(dto, mockUserReq);

      expect(service.confirm).toHaveBeenCalledWith(dto, 100);
      expect(result.status).toBe(PaymentStatus.COMPLETED);
    });
  });

  describe('findMyPayments', () => {
    it('should return current user payments', async () => {
      service.findByUser.mockResolvedValue([mockPayment] as any);

      const result = await controller.findMyPayments(mockUserReq);

      expect(service.findByUser).toHaveBeenCalledWith(100);
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findByOrder', () => {
    it('should return payments for an order', async () => {
      service.findByOrder.mockResolvedValue([mockPayment] as any);

      const result = await controller.findByOrder(10);

      expect(service.findByOrder).toHaveBeenCalledWith(10);
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findAll', () => {
    it('should return all payments', async () => {
      service.findAll.mockResolvedValue([mockPayment] as any);

      const result = await controller.findAll();

      expect(service.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockPayment]);
    });
  });

  describe('findOne', () => {
    it('should return a single payment', async () => {
      service.findOne.mockResolvedValue(mockPayment as any);

      const result = await controller.findOne(1, mockUserReq);

      expect(service.findOne).toHaveBeenCalledWith(1, mockUserReq.user);
      expect(result).toEqual(mockPayment);
    });
  });

  describe('refund', () => {
    it('should refund a payment', async () => {
      const dto = { reason: 'Retour produit' };
      const refunded = { ...mockPayment, status: PaymentStatus.REFUNDED };
      service.refund.mockResolvedValue(refunded as any);

      const result = await controller.refund(1, dto, mockUserReq);

      expect(service.refund).toHaveBeenCalledWith(1, dto, mockUserReq.user);
      expect(result.status).toBe(PaymentStatus.REFUNDED);
    });
  });
});
