import { Test, TestingModule } from '@nestjs/testing';
import { CartsController } from './carts.controller';
import { CartsService } from './carts.service';
import { Cart } from './entities/cart.entity';

describe('CartsController', () => {
  let controller: CartsController;
  let service: jest.Mocked<Partial<CartsService>>;

  const mockUser = { id: 10, role: 'user' };
  const mockReq = { user: mockUser } as any;

  beforeEach(async () => {
    service = {
      findByUser: jest.fn(),
      addItem: jest.fn(),
      updateItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CartsController],
      providers: [{ provide: CartsService, useValue: service }],
    }).compile();

    controller = module.get<CartsController>(CartsController);
  });

  describe('findMine', () => {
    it('should return the cart for the authenticated user', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      service.findByUser.mockResolvedValue(cart);

      const result = await controller.findMine(mockReq);

      expect(service.findByUser).toHaveBeenCalledWith(10);
      expect(result).toBe(cart);
    });
  });

  describe('addItem', () => {
    it('should add an item and return updated cart', async () => {
      const dto = { product_id: 42, quantity: 2 };
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      service.addItem.mockResolvedValue(cart);

      const result = await controller.addItem(dto, mockReq);

      expect(service.addItem).toHaveBeenCalledWith(10, dto);
      expect(result).toBe(cart);
    });
  });

  describe('updateItem', () => {
    it('should update item quantity', async () => {
      const dto = { quantity: 5 };
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      service.updateItem.mockResolvedValue(cart);

      const result = await controller.updateItem(7, dto, mockReq);

      expect(service.updateItem).toHaveBeenCalledWith(10, 7, dto);
      expect(result).toBe(cart);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      service.removeItem.mockResolvedValue(cart);

      const result = await controller.removeItem(7, mockReq);

      expect(service.removeItem).toHaveBeenCalledWith(10, 7);
      expect(result).toBe(cart);
    });
  });

  describe('clear', () => {
    it('should clear the cart', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      service.clear.mockResolvedValue(cart);

      const result = await controller.clear(mockReq);

      expect(service.clear).toHaveBeenCalledWith(10);
      expect(result).toBe(cart);
    });
  });
});
