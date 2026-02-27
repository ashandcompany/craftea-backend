import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Favorite } from './entities/favorite.entity.js';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectRepository(Favorite)
    private favoritesRepo: Repository<Favorite>,
  ) {}

  async add(userId: number, productId: number) {
    const existing = await this.favoritesRepo.findOne({
      where: { user_id: userId, product_id: productId },
    });
    if (existing) {
      throw new ConflictException('Produit déjà en favoris');
    }

    const favorite = this.favoritesRepo.create({
      user_id: userId,
      product_id: productId,
    });
    return this.favoritesRepo.save(favorite);
  }

  async remove(userId: number, productId: number) {
    const result = await this.favoritesRepo.delete({
      user_id: userId,
      product_id: productId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Favori introuvable');
    }
    return { message: 'Favori supprimé' };
  }

  async getMyFavorites(userId: number, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const [rows, total] = await this.favoritesRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: offset,
      take: limit,
    });

    return { total, page, limit, data: rows };
  }

  async check(userId: number, productId: number) {
    const favorite = await this.favoritesRepo.findOne({
      where: { user_id: userId, product_id: productId },
    });
    return { isFavorite: !!favorite };
  }
}
