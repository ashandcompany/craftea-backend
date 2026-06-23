import { Test, TestingModule } from '@nestjs/testing';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';

describe('FavoritesController', () => {
  let controller: FavoritesController;
  let service: jest.Mocked<FavoritesService>;

  const mockReq = { user: { id: 100 } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FavoritesController],
      providers: [
        {
          provide: FavoritesService,
          useValue: {
            add: jest.fn(),
            remove: jest.fn(),
            getMyFavorites: jest.fn(),
            check: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<FavoritesController>(FavoritesController);
    service = module.get(FavoritesService) as jest.Mocked<FavoritesService>;
  });

  describe('getMyFavorites', () => {
    it('should return paginated favorites', async () => {
      const expected = { total: 1, page: 1, limit: 20, data: [] };
      service.getMyFavorites.mockResolvedValue(expected);

      const result = await controller.getMyFavorites(mockReq, 1, 20);

      expect(service.getMyFavorites).toHaveBeenCalledWith(100, 1, 20);
      expect(result).toEqual(expected);
    });
  });

  describe('check', () => {
    it('should check if product is favorited', async () => {
      const expected = { isFavorite: true };
      service.check.mockResolvedValue(expected);

      const result = await controller.check(mockReq, 42);

      expect(service.check).toHaveBeenCalledWith(100, 42);
      expect(result).toEqual(expected);
    });
  });

  describe('add', () => {
    it('should add a favorite', async () => {
      const favorite = { id: 1, user_id: 100, product_id: 42, created_at: new Date() };
      service.add.mockResolvedValue(favorite as any);

      const result = await controller.add(mockReq, { product_id: 42 });

      expect(service.add).toHaveBeenCalledWith(100, 42);
      expect(result).toEqual(favorite);
    });
  });

  describe('remove', () => {
    it('should remove a favorite', async () => {
      const expected = { message: 'Favori supprimé' };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove(mockReq, 42);

      expect(service.remove).toHaveBeenCalledWith(100, 42);
      expect(result).toEqual(expected);
    });
  });
});
