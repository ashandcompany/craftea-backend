import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity.js';
import { RedisService } from '../redis/redis.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private categoriesRepo: Repository<Category>,
    private redis: RedisService,
  ) {}

  async findAll() {
    const cached = await this.redis.getCache('categories:list');
    if (cached) return cached;

    const categories = await this.categoriesRepo.find({ order: { name: 'ASC' } });
    await this.redis.setCache('categories:list', categories);
    return categories;
  }

  async findById(id: number) {
    const cached = await this.redis.getCache(`categories:${id}`);
    if (cached) return cached;

    const cat = await this.categoriesRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Catégorie introuvable');
    await this.redis.setCache(`categories:${id}`, cat);
    return cat;
  }

  async create(dto: CreateCategoryDto) {
    const cat = this.categoriesRepo.create({
      name: dto.name,
      description: dto.description,
      icon: dto.icon || 'Package',
    });
    const saved = await this.categoriesRepo.save(cat);
    await this.redis.invalidateCache('categories:*');
    return saved;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    const cat = await this.categoriesRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Catégorie introuvable');

    if (dto.name !== undefined) cat.name = dto.name;
    if (dto.description !== undefined) cat.description = dto.description;
    if (dto.icon !== undefined) cat.icon = dto.icon;

    const saved = await this.categoriesRepo.save(cat);
    await this.redis.invalidateCache('categories:*');
    return saved;
  }

  async remove(id: number) {
    const result = await this.categoriesRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Catégorie introuvable');
    await this.redis.invalidateCache('categories:*');
    return { message: 'Catégorie supprimée' };
  }
}
