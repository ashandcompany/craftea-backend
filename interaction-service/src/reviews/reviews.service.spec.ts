import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
  HttpException,
} from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { ReviewsService } from './reviews.service';
import { Review } from './entities/review.entity';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewsRepo: jest.Mocked<Repository<Review>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockReview: Review = {
    id: 1,
    user_id: 100,
    product_id: 42,
    rating: 4,
    comment: 'Very nice product, I love it!',
    created_at: new Date('2025-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        {
          provide: getRepositoryToken(Review),
          useValue: {
            findOne: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
    reviewsRepo = module.get(getRepositoryToken(Review)) as jest.Mocked<Repository<Review>>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
  });

  describe('create', () => {
    const dto = { product_id: 42, rating: 4, comment: 'Very nice product, I love it!' };

    it('should create a review', async () => {
      // No previous review (anti-spam)
      reviewsRepo.findOne.mockResolvedValueOnce(null);
      // No existing review for this user/product
      reviewsRepo.findOne.mockResolvedValueOnce(null);
      reviewsRepo.create.mockReturnValue(mockReview);
      reviewsRepo.save.mockResolvedValue(mockReview);

      const result = await service.create(100, dto);

      expect(reviewsRepo.create).toHaveBeenCalledWith({
        user_id: 100,
        product_id: 42,
        rating: 4,
        comment: 'Very nice product, I love it!',
      });
      expect(reviewsRepo.save).toHaveBeenCalledWith(mockReview);
      expect(result).toEqual(mockReview);
    });

    it('should throw HttpException (429) if anti-spam cooldown active', async () => {
      const recentReview = { ...mockReview, created_at: new Date() };
      reviewsRepo.findOne.mockResolvedValueOnce(recentReview);

      await expect(service.create(100, dto)).rejects.toThrow(HttpException);
    });

    it('should throw ConflictException if review already exists for product', async () => {
      // No anti-spam hit (old review)
      const oldReview = { ...mockReview, created_at: new Date('2020-01-01') };
      reviewsRepo.findOne.mockResolvedValueOnce(oldReview);
      // Existing review found
      reviewsRepo.findOne.mockResolvedValueOnce(mockReview);

      await expect(service.create(100, dto)).rejects.toThrow(ConflictException);
    });

    it('should throw UnprocessableEntityException if comment is too short', async () => {
      reviewsRepo.findOne.mockResolvedValueOnce(null);
      reviewsRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create(100, { product_id: 42, rating: 4, comment: 'Short' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should allow creating a review without comment', async () => {
      const noCommentReview = { ...mockReview, comment: undefined };
      reviewsRepo.findOne.mockResolvedValueOnce(null);
      reviewsRepo.findOne.mockResolvedValueOnce(null);
      reviewsRepo.create.mockReturnValue(noCommentReview as Review);
      reviewsRepo.save.mockResolvedValue(noCommentReview as Review);

      const result = await service.create(100, { product_id: 42, rating: 5 });

      expect(result).toEqual(noCommentReview);
    });
  });

  describe('getByProduct', () => {
    it('should return paginated reviews with reviewer names', async () => {
      const reviews = [mockReview];
      reviewsRepo.findAndCount.mockResolvedValue([reviews, 1]);
      dataSource.query.mockResolvedValue([
        { id: 100, firstname: 'Alice', lastname: 'Dupont' },
      ]);

      const result = await service.getByProduct(42, 1, 20);

      expect(reviewsRepo.findAndCount).toHaveBeenCalledWith({
        where: { product_id: 42 },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.data[0]).toHaveProperty('reviewer_name', 'Alice D.');
    });

    it('should return empty data when no reviews', async () => {
      reviewsRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getByProduct(42);

      expect(result).toEqual({ total: 0, page: 1, limit: 20, data: [] });
    });
  });

  describe('getAverageRating', () => {
    it('should return the average rating and count', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ average: '4.25', count: '10' }),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getAverageRating(42);

      expect(result).toEqual({ product_id: 42, average: 4.25, count: 10 });
    });

    it('should return null average when no reviews', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ average: null, count: '0' }),
      };
      reviewsRepo.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getAverageRating(99);

      expect(result).toEqual({ product_id: 99, average: null, count: 0 });
    });
  });

  describe('update', () => {
    it('should update a review by its owner', async () => {
      const updatedReview = { ...mockReview, rating: 5 };
      reviewsRepo.findOne.mockResolvedValue(mockReview);
      reviewsRepo.save.mockResolvedValue(updatedReview);

      const result = await service.update(1, 100, 'user', { rating: 5 });

      expect(reviewsRepo.save).toHaveBeenCalled();
      expect(result.rating).toBe(5);
    });

    it('should allow admin to update any review', async () => {
      const updatedReview = { ...mockReview, rating: 2 };
      reviewsRepo.findOne.mockResolvedValue(mockReview);
      reviewsRepo.save.mockResolvedValue(updatedReview);

      const result = await service.update(1, 999, 'admin', { rating: 2 });

      expect(result.rating).toBe(2);
    });

    it('should throw NotFoundException if review does not exist', async () => {
      reviewsRepo.findOne.mockResolvedValue(null);

      await expect(service.update(999, 100, 'user', { rating: 3 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if user is not owner and not admin', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview);

      await expect(service.update(1, 999, 'user', { rating: 3 })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException if no modification provided', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview);

      await expect(service.update(1, 100, 'user', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw UnprocessableEntityException if comment is too short', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview);

      await expect(
        service.update(1, 100, 'user', { comment: 'Short' }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('remove', () => {
    it('should remove a review by its owner', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview);
      reviewsRepo.remove.mockResolvedValue(mockReview);

      const result = await service.remove(1, 100, 'user');

      expect(reviewsRepo.remove).toHaveBeenCalledWith(mockReview);
      expect(result).toEqual({ message: 'Avis supprimé' });
    });

    it('should allow admin to remove any review', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview);
      reviewsRepo.remove.mockResolvedValue(mockReview);

      const result = await service.remove(1, 999, 'admin');

      expect(result).toEqual({ message: 'Avis supprimé' });
    });

    it('should throw NotFoundException if review does not exist', async () => {
      reviewsRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(999, 100, 'user')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not owner and not admin', async () => {
      reviewsRepo.findOne.mockResolvedValue(mockReview);

      await expect(service.remove(1, 999, 'user')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMyReviews', () => {
    it('should return paginated user reviews with names', async () => {
      reviewsRepo.findAndCount.mockResolvedValue([[mockReview], 1]);
      dataSource.query.mockResolvedValue([
        { id: 100, firstname: 'Alice', lastname: 'Dupont' },
      ]);

      const result = await service.getMyReviews(100, 1, 20);

      expect(reviewsRepo.findAndCount).toHaveBeenCalledWith({
        where: { user_id: 100 },
        order: { created_at: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result.total).toBe(1);
      expect(result.data[0]).toHaveProperty('reviewer_name', 'Alice D.');
    });
  });
});
