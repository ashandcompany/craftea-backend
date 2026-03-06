import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { FavoritesService } from './favorites.service';
import { Favorite } from './entities/favorite.entity';

describe('FavoritesService', () => {
  let service: FavoritesService;
  let favoritesRepo: jest.Mocked<Repository<Favorite>>;

  const mockFavorite: Favorite = {
    id: 1,
    user_id: 100,
    product_id: 42,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: getRepositoryToken(Favorite),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FavoritesService>(FavoritesService);
    favoritesRepo = module.get(getRepositoryToken(Favorite)) as jest.Mocked<Repository<Favorite>>;
  });

  describe('add', () => {
    it('should add a favorite', async () => {
      favoritesRepo.findOne.mockResolvedValue(null);
      favoritesRepo.create.mockReturnValue(mockFavorite);
      favoritesRepo.save.mockResolvedValue(mockFavorite);

      const result = await service.add(100, 42);

      expect(favoritesRepo.findOne).toHaveBeenCalledWith({
        where: { user_id: 100, product_id: 42 },
      });
      expect(favoritesRepo.create).toHaveBeenCalledWith({
        user_id: 100,
        product_id: 42,
      });
      expect(favoritesRepo.save).toHaveBeenCalledWith(mockFavorite);
      expect(result).toEqual(mockFavorite);
    });

    it('should throw ConflictException if favorite already exists', async () => {
      favoritesRepo.findOne.mockResolvedValue(mockFavorite);

      await expect(service.add(100, 42)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should remove a favorite', async () => {
      favoritesRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      const result = await service.remove(100, 42);

      expect(favoritesRepo.delete).toHaveBeenCalledWith({
        user_id: 100,
        product_id: 42,
      });
      expect(result).toEqual({ message: 'Favori supprimé' });
    });

    it('should throw NotFoundException if favorite does not exist', async () => {
      favoritesRepo.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.remove(100, 42)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMyFavorites', () => {
    it('should return paginated favorites', async () => {
      const favorites = [mockFavorite];
      favoritesRepo.findAndCount.mockResolvedValue([favorites, 1]);

      const result = await service.getMyFavorites(100, 1, 20);

      expect(favoritesRepo.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 100 },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ total: 1, page: 1, limit: 20, data: favorites });
    });

    it('should calculate correct offset for page 2', async () => {
      favoritesRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.getMyFavorites(100, 2, 10);

      expect(favoritesRepo.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 100 },
        order: { created_at: 'DESC' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('check', () => {
    it('should return isFavorite true when favorite exists', async () => {
      favoritesRepo.findOne.mockResolvedValue(mockFavorite);

      const result = await service.check(100, 42);

      expect(result).toEqual({ isFavorite: true });
    });

    it('should return isFavorite false when favorite does not exist', async () => {
      favoritesRepo.findOne.mockResolvedValue(null);

      const result = await service.check(100, 42);

      expect(result).toEqual({ isFavorite: false });
    });
  });
});
