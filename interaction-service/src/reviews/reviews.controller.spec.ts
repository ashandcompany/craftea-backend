import { Test, TestingModule } from '@nestjs/testing';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let service: jest.Mocked<ReviewsService>;

  const mockReq = { user: { id: 100, role: 'user' } };
  const mockAdminReq = { user: { id: 1, role: 'admin' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        {
          provide: ReviewsService,
          useValue: {
            create: jest.fn(),
            getByProduct: jest.fn(),
            getAverageRating: jest.fn(),
            getMyReviews: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
    service = module.get(ReviewsService) as jest.Mocked<ReviewsService>;
  });

  describe('getByProduct', () => {
    it('should return reviews for a product', async () => {
      const expected = { total: 1, page: 1, limit: 20, data: [] };
      service.getByProduct.mockResolvedValue(expected);

      const result = await controller.getByProduct(42, 1, 20);

      expect(service.getByProduct).toHaveBeenCalledWith(42, 1, 20);
      expect(result).toEqual(expected);
    });
  });

  describe('getAverageRating', () => {
    it('should return average rating for a product', async () => {
      const expected = { product_id: 42, average: 4.5, count: 10 };
      service.getAverageRating.mockResolvedValue(expected);

      const result = await controller.getAverageRating(42);

      expect(service.getAverageRating).toHaveBeenCalledWith(42);
      expect(result).toEqual(expected);
    });
  });

  describe('getMyReviews', () => {
    it('should return current user reviews', async () => {
      const expected = { total: 1, page: 1, limit: 20, data: [] };
      service.getMyReviews.mockResolvedValue(expected);

      const result = await controller.getMyReviews(mockReq, 1, 20);

      expect(service.getMyReviews).toHaveBeenCalledWith(100, 1, 20);
      expect(result).toEqual(expected);
    });
  });

  describe('create', () => {
    it('should create a review', async () => {
      const dto = { product_id: 42, rating: 5, comment: 'Excellent product!' };
      const review = { id: 1, user_id: 100, ...dto, created_at: new Date() };
      service.create.mockResolvedValue(review as any);

      const result = await controller.create(mockReq, dto);

      expect(service.create).toHaveBeenCalledWith(100, dto);
      expect(result).toEqual(review);
    });
  });

  describe('update', () => {
    it('should update a review', async () => {
      const dto = { rating: 3 };
      const updated = { id: 1, user_id: 100, product_id: 42, rating: 3, comment: null, created_at: new Date() };
      service.update.mockResolvedValue(updated as any);

      const result = await controller.update(1, mockReq, dto);

      expect(service.update).toHaveBeenCalledWith(1, 100, 'user', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('remove', () => {
    it('should remove a review', async () => {
      const expected = { message: 'Avis supprimé' };
      service.remove.mockResolvedValue(expected);

      const result = await controller.remove(1, mockReq);

      expect(service.remove).toHaveBeenCalledWith(1, 100, 'user');
      expect(result).toEqual(expected);
    });
  });
});
