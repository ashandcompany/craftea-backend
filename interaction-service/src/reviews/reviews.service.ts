import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Review } from './entities/review.entity.js';

const SPAM_COOLDOWN_MS = 60 * 1000; // 1 minute

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private reviewsRepo: Repository<Review>,
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  // ---- Helper: attach reviewer names from craftea_users DB ----
  private async withReviewerNames(reviews: Review[]) {
    if (!reviews.length) return reviews;

    const userIds = [...new Set(reviews.map((r) => r.user_id).filter(Boolean))];
    if (!userIds.length) return reviews.map((r) => ({ ...r, reviewer_name: null }));

    const users: { id: number; firstname: string; lastname: string }[] =
      await this.dataSource.query(
        `SELECT id, firstname, lastname FROM craftea_users.users WHERE id = ANY($1)`,
        [userIds],
      );

    const userMap = new Map(
      users.map((u) => {
        const lastnameInitial = u.lastname
          ? `${u.lastname.charAt(0).toUpperCase()}.`
          : '';
        const fullName = [u.firstname, lastnameInitial].filter(Boolean).join(' ');
        return [u.id, fullName || null];
      }),
    );

    return reviews.map((r) => ({
      ...r,
      reviewer_name: userMap.get(r.user_id) || null,
    }));
  }

  async create(userId: number, dto: { product_id: number; rating: number; comment?: string }) {
    // Anti-spam
    const lastReview = await this.reviewsRepo.findOne({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });

    if (lastReview) {
      const elapsed = Date.now() - new Date(lastReview.created_at).getTime();
      if (elapsed < SPAM_COOLDOWN_MS) {
        const wait = Math.ceil((SPAM_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `Anti-spam : veuillez attendre ${wait}s avant de poster un nouvel avis`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // One review per user/product
    const existing = await this.reviewsRepo.findOne({
      where: { user_id: userId, product_id: dto.product_id },
    });
    if (existing) {
      throw new ConflictException('Vous avez déjà posté un avis pour ce produit');
    }

    // Moderate short comments
    if (dto.comment && dto.comment.trim().length > 0 && dto.comment.trim().length < 10) {
      throw new UnprocessableEntityException('Le commentaire doit faire au moins 10 caractères');
    }

    const review = this.reviewsRepo.create({
      user_id: userId,
      product_id: dto.product_id,
      rating: dto.rating,
      comment: dto.comment,
    });
    return this.reviewsRepo.save(review);
  }

  async getByProduct(productId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [rows, total] = await this.reviewsRepo.findAndCount({
      where: { product_id: productId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data = await this.withReviewerNames(rows);
    return { total, page, limit, data };
  }

  async getAverageRating(productId: number) {
    const result = await this.reviewsRepo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'average')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.product_id = :productId', { productId })
      .getRawOne();

    return {
      product_id: productId,
      average: result.average ? parseFloat(parseFloat(result.average).toFixed(2)) : null,
      count: parseInt(result.count) || 0,
    };
  }

  async update(
    reviewId: number,
    userId: number,
    userRole: string,
    dto: { rating?: number; comment?: string },
  ) {
    const review = await this.reviewsRepo.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Avis introuvable');
    }

    if (review.user_id !== userId && userRole !== 'admin') {
      throw new ForbiddenException('Accès interdit');
    }

    if (dto.rating === undefined && dto.comment === undefined) {
      throw new BadRequestException('Aucune modification fournie');
    }

    if (dto.comment !== undefined && dto.comment.trim().length > 0 && dto.comment.trim().length < 10) {
      throw new UnprocessableEntityException('Le commentaire doit faire au moins 10 caractères');
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.comment !== undefined) review.comment = dto.comment;

    return this.reviewsRepo.save(review);
  }

  async remove(reviewId: number, userId: number, userRole: string) {
    const review = await this.reviewsRepo.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Avis introuvable');
    }

    if (review.user_id !== userId && userRole !== 'admin') {
      throw new ForbiddenException('Accès interdit');
    }

    await this.reviewsRepo.remove(review);
    return { message: 'Avis supprimé' };
  }

  async getMyReviews(userId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [rows, total] = await this.reviewsRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    const data = await this.withReviewerNames(rows);
    return { total, page, limit, data };
  }
}
