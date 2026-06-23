import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: jest.Mocked<Partial<ProductsService>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      updateStock: jest.fn(),
      decrementStock: jest.fn(),
      toggleActive: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: service }],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  describe('findAll', () => {
    it('should return paginated products', async () => {
      const result = { total: 1, page: 1, limit: 20, data: [{ id: 1 }] };
      service.findAll.mockResolvedValue(result as any);

      expect(await controller.findAll({})).toBe(result);
    });
  });

  describe('findOne', () => {
    it('should return a single product', async () => {
      const product = { id: 1, title: 'Vase' };
      service.findById.mockResolvedValue(product as any);

      expect(await controller.findOne(1)).toBe(product);
      expect(service.findById).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should delegate to service with dto and files', async () => {
      const dto = { shop_id: 10, title: 'Vase' } as any;
      const files = [] as Express.Multer.File[];
      const product = { id: 1, title: 'Vase' };
      service.create.mockResolvedValue(product as any);

      expect(await controller.create(dto, files)).toBe(product);
      expect(service.create).toHaveBeenCalledWith(dto, files);
    });
  });

  describe('update', () => {
    it('should delegate to service with id, dto and files', async () => {
      const dto = { title: 'Updated' } as any;
      const files = [] as Express.Multer.File[];
      const product = { id: 1, title: 'Updated' };
      service.update.mockResolvedValue(product as any);

      expect(await controller.update(1, dto, files)).toBe(product);
      expect(service.update).toHaveBeenCalledWith(1, dto, files);
    });
  });

  describe('remove', () => {
    it('should delete the product', async () => {
      const result = { message: 'Produit supprimé' };
      service.remove.mockResolvedValue(result);

      expect(await controller.remove(1)).toBe(result);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });

  describe('updateStock', () => {
    it('should update stock', async () => {
      const result = { id: 1, stock: 20 };
      service.updateStock.mockResolvedValue(result);

      expect(await controller.updateStock(1, 20)).toBe(result);
      expect(service.updateStock).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('decrementStock', () => {
    it('should decrement stock', async () => {
      const result = { id: 1, stock: 7 };
      service.decrementStock.mockResolvedValue(result);

      expect(await controller.decrementStock(1, 3)).toBe(result);
      expect(service.decrementStock).toHaveBeenCalledWith(1, 3);
    });
  });

  describe('toggleActive', () => {
    it('should toggle active state', async () => {
      const result = { id: 1, is_active: false };
      service.toggleActive.mockResolvedValue(result);

      expect(await controller.toggleActive(1)).toBe(result);
      expect(service.toggleActive).toHaveBeenCalledWith(1);
    });
  });
});
