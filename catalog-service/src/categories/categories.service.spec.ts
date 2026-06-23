import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';
import { RedisService } from '../redis/redis.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let repo: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    redis = {
      getCache: jest.fn(),
      setCache: jest.fn(),
      invalidateCache: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: getRepositoryToken(Category), useValue: repo },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('should return cached categories when available', async () => {
      const cached = [{ id: 1, name: 'Bijoux' }];
      redis.getCache.mockResolvedValue(cached);

      const result = await service.findAll();

      expect(redis.getCache).toHaveBeenCalledWith('categories:list');
      expect(repo.find).not.toHaveBeenCalled();
      expect(result).toBe(cached);
    });

    it('should query DB and cache when no cache hit', async () => {
      const categories = [
        { id: 1, name: 'Bijoux' },
        { id: 2, name: 'Céramique' },
      ];
      redis.getCache.mockResolvedValue(null);
      repo.find.mockResolvedValue(categories);

      const result = await service.findAll();

      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
      expect(redis.setCache).toHaveBeenCalledWith('categories:list', categories);
      expect(result).toBe(categories);
    });
  });

  // ---------- findById ----------

  describe('findById', () => {
    it('should return cached category', async () => {
      const cat = { id: 1, name: 'Bijoux' };
      redis.getCache.mockResolvedValue(cat);

      const result = await service.findById(1);

      expect(redis.getCache).toHaveBeenCalledWith('categories:1');
      expect(result).toBe(cat);
    });

    it('should query DB and cache when not cached', async () => {
      const cat = { id: 1, name: 'Bijoux' };
      redis.getCache.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(cat);

      const result = await service.findById(1);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(redis.setCache).toHaveBeenCalledWith('categories:1', cat);
      expect(result).toBe(cat);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      redis.getCache.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- create ----------

  describe('create', () => {
    it('should create category and invalidate cache', async () => {
      const dto = { name: 'Poterie', description: 'Artisan pottery' };
      const entity = { id: 1, name: 'Poterie', description: 'Artisan pottery', icon: 'Package' };
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith({
        name: 'Poterie',
        description: 'Artisan pottery',
        icon: 'Package',
      });
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(redis.invalidateCache).toHaveBeenCalledWith('categories:*');
      expect(result).toBe(entity);
    });

    it('should use provided icon', async () => {
      const dto = { name: 'Bois', icon: 'Tree' };
      const entity = { id: 2, name: 'Bois', icon: 'Tree' };
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await service.create(dto);

      expect(repo.create).toHaveBeenCalledWith({
        name: 'Bois',
        description: undefined,
        icon: 'Tree',
      });
    });
  });

  // ---------- update ----------

  describe('update', () => {
    it('should update category fields and invalidate cache', async () => {
      const existing = { id: 1, name: 'Old', description: null, icon: 'Package' };
      repo.findOne.mockResolvedValue(existing);
      repo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update(1, { name: 'New', icon: 'Star' });

      expect(existing.name).toBe('New');
      expect(existing.icon).toBe('Star');
      expect(redis.invalidateCache).toHaveBeenCalledWith('categories:*');
      expect(result).toEqual(existing);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(999, { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- remove ----------

  describe('remove', () => {
    it('should delete category and invalidate cache', async () => {
      repo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(repo.delete).toHaveBeenCalledWith(1);
      expect(redis.invalidateCache).toHaveBeenCalledWith('categories:*');
      expect(result).toEqual({ message: 'Catégorie supprimée' });
    });

    it('should throw NotFoundException when category does not exist', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
