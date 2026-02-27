import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './entities/tag.entity.js';
import { CreateTagDto } from './dto/create-tag.dto.js';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag) private tagsRepo: Repository<Tag>,
  ) {}

  async findAll() {
    return this.tagsRepo.find({ order: { name: 'ASC' } });
  }

  async create(dto: CreateTagDto) {
    const tag = this.tagsRepo.create({ name: dto.name });
    return this.tagsRepo.save(tag);
  }

  async remove(id: number) {
    const result = await this.tagsRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Tag introuvable');
    return { message: 'Tag supprimé' };
  }
}
