import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let service: jest.Mocked<Partial<CategoriesService>>;

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: service }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
  });

  describe('findAll', () => {
    it('should return all categories', async () => {
      const categories = [{ id: 1, name: 'Bijoux' }];
      service.findAll.mockResolvedValue(categories);

      expect(await controller.findAll()).toBe(categories);
    });
  });

  describe('findById', () => {
    it('should return a single category', async () => {
      const cat = { id: 1, name: 'Bijoux' };
      service.findById.mockResolvedValue(cat);

      expect(await controller.findById(1)).toBe(cat);
      expect(service.findById).toHaveBeenCalledWith(1);
    });
  });

  describe('create', () => {
    it('should create a category', async () => {
      const dto = { name: 'Poterie' };
      const saved = { id: 1, name: 'Poterie', icon: 'Package', description: null };
      service.create.mockResolvedValue(saved);

      expect(await controller.create(dto)).toBe(saved);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('update', () => {
    it('should update a category', async () => {
      const dto = { name: 'New Name' };
      const updated = { id: 1, name: 'New Name', icon: 'Package', description: null };
      service.update.mockResolvedValue(updated);

      expect(await controller.update(1, dto)).toBe(updated);
      expect(service.update).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('remove', () => {
    it('should remove a category', async () => {
      const result = { message: 'Catégorie supprimée' };
      service.remove.mockResolvedValue(result);

      expect(await controller.remove(1)).toBe(result);
      expect(service.remove).toHaveBeenCalledWith(1);
    });
  });
});
