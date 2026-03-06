import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CartsService } from './carts.service';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';

describe('CartsService', () => {
  let service: CartsService;
  let cartsRepo: Record<string, jest.Mock>;
  let itemsRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    cartsRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    itemsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartsService,
        { provide: getRepositoryToken(Cart), useValue: cartsRepo },
        { provide: getRepositoryToken(CartItem), useValue: itemsRepo },
      ],
    }).compile();

    service = module.get<CartsService>(CartsService);
  });

  // ---------- getOrCreateCart / findByUser ----------

  describe('getOrCreateCart', () => {
    it('should return existing cart', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      cartsRepo.findOne.mockResolvedValue(cart);

      const result = await service.getOrCreateCart(10);

      expect(cartsRepo.findOne).toHaveBeenCalledWith({ where: { user_id: 10 } });
      expect(result).toBe(cart);
    });

    it('should create a new cart when none exists', async () => {
      const newCart = { id: 2, user_id: 10, items: [] } as Cart;
      cartsRepo.findOne.mockResolvedValue(null);
      cartsRepo.create.mockReturnValue(newCart);
      cartsRepo.save.mockResolvedValue(newCart);

      const result = await service.getOrCreateCart(10);

      expect(cartsRepo.create).toHaveBeenCalledWith({ user_id: 10, items: [] });
      expect(cartsRepo.save).toHaveBeenCalledWith(newCart);
      expect(result).toBe(newCart);
    });
  });

  describe('findByUser', () => {
    it('should delegate to getOrCreateCart', async () => {
      const cart = { id: 1, user_id: 5, items: [] } as Cart;
      cartsRepo.findOne.mockResolvedValue(cart);

      const result = await service.findByUser(5);
      expect(result).toBe(cart);
    });
  });

  // ---------- addItem ----------

  describe('addItem', () => {
    it('should add a new item to the cart', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      const newItem = { id: 1, cart_id: 1, product_id: 42, quantity: 2 } as CartItem;
      const updatedCart = { ...cart, items: [newItem] } as Cart;

      cartsRepo.findOne
        .mockResolvedValueOnce(cart)    // getOrCreateCart
        .mockResolvedValueOnce(updatedCart); // reload
      itemsRepo.create.mockReturnValue(newItem);
      itemsRepo.save.mockResolvedValue(newItem);

      const result = await service.addItem(10, { product_id: 42, quantity: 2 });

      expect(itemsRepo.create).toHaveBeenCalledWith({
        cart_id: 1,
        product_id: 42,
        quantity: 2,
      });
      expect(itemsRepo.save).toHaveBeenCalledWith(newItem);
      expect(result).toEqual(updatedCart);
    });

    it('should increment quantity when product already in cart', async () => {
      const existingItem = { id: 5, cart_id: 1, product_id: 42, quantity: 1 } as CartItem;
      const cart = { id: 1, user_id: 10, items: [existingItem] } as Cart;
      const updatedCart = { ...cart, items: [{ ...existingItem, quantity: 3 }] } as Cart;

      cartsRepo.findOne
        .mockResolvedValueOnce(cart)
        .mockResolvedValueOnce(updatedCart);
      itemsRepo.save.mockResolvedValue({ ...existingItem, quantity: 3 });

      const result = await service.addItem(10, { product_id: 42, quantity: 2 });

      expect(existingItem.quantity).toBe(3);
      expect(itemsRepo.save).toHaveBeenCalledWith(existingItem);
      expect(result).toEqual(updatedCart);
    });
  });

  // ---------- updateItem ----------

  describe('updateItem', () => {
    it('should update item quantity', async () => {
      const item = { id: 5, cart_id: 1, product_id: 42, quantity: 1 } as CartItem;
      const cart = { id: 1, user_id: 10, items: [item] } as Cart;
      const updatedCart = { ...cart, items: [{ ...item, quantity: 5 }] } as Cart;

      cartsRepo.findOne
        .mockResolvedValueOnce(cart)
        .mockResolvedValueOnce(updatedCart);
      itemsRepo.save.mockResolvedValue({ ...item, quantity: 5 });

      const result = await service.updateItem(10, 5, { quantity: 5 });

      expect(item.quantity).toBe(5);
      expect(itemsRepo.save).toHaveBeenCalledWith(item);
      expect(result).toEqual(updatedCart);
    });

    it('should throw NotFoundException when item not in cart', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      cartsRepo.findOne.mockResolvedValue(cart);

      await expect(service.updateItem(10, 99, { quantity: 5 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ---------- removeItem ----------

  describe('removeItem', () => {
    it('should remove item from cart', async () => {
      const item = { id: 5, cart_id: 1, product_id: 42, quantity: 2 } as CartItem;
      const cart = { id: 1, user_id: 10, items: [item] } as Cart;
      const emptyCart = { id: 1, user_id: 10, items: [] } as Cart;

      cartsRepo.findOne
        .mockResolvedValueOnce(cart)
        .mockResolvedValueOnce(emptyCart);
      itemsRepo.remove.mockResolvedValue(item);

      const result = await service.removeItem(10, 5);

      expect(itemsRepo.remove).toHaveBeenCalledWith(item);
      expect(result).toEqual(emptyCart);
    });

    it('should throw NotFoundException when item not found', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      cartsRepo.findOne.mockResolvedValue(cart);

      await expect(service.removeItem(10, 99)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- clear ----------

  describe('clear', () => {
    it('should remove all items from the cart', async () => {
      const items = [
        { id: 1, product_id: 10, quantity: 1 },
        { id: 2, product_id: 20, quantity: 3 },
      ] as CartItem[];
      const cart = { id: 1, user_id: 10, items } as Cart;
      const emptyCart = { id: 1, user_id: 10, items: [] } as Cart;

      cartsRepo.findOne
        .mockResolvedValueOnce(cart)
        .mockResolvedValueOnce(emptyCart);
      itemsRepo.remove.mockResolvedValue(items);

      const result = await service.clear(10);

      expect(itemsRepo.remove).toHaveBeenCalledWith(items);
      expect(result).toEqual(emptyCart);
    });

    it('should handle empty cart gracefully', async () => {
      const cart = { id: 1, user_id: 10, items: [] } as Cart;
      cartsRepo.findOne.mockResolvedValue(cart);

      const result = await service.clear(10);

      expect(itemsRepo.remove).not.toHaveBeenCalled();
      expect(result).toEqual(cart);
    });
  });
});
