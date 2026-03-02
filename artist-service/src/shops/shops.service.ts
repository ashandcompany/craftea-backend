import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './entities/shop.entity.js';
import { ArtistProfile } from '../artists/entities/artist-profile.entity.js';
import { MinioService } from '../minio/minio.service.js';
import { CreateShopDto } from './dto/create-shop.dto.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop) private shopsRepo: Repository<Shop>,
    @InjectRepository(ArtistProfile) private artistsRepo: Repository<ArtistProfile>,
    private minioService: MinioService,
  ) {}

  private async getArtistProfile(userId: number): Promise<ArtistProfile> {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile)
      throw new BadRequestException('Profil artiste requis pour créer une boutique');
    return profile;
  }

  async create(
    dto: CreateShopDto,
    userId: number,
    files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    const profile = await this.getArtistProfile(userId);

    const banner_url = files.banner?.[0]
      ? await this.minioService.uploadFile(files.banner[0])
      : null;
    const logo_url = files.logo?.[0]
      ? await this.minioService.uploadFile(files.logo[0])
      : null;

    const shop = this.shopsRepo.create({
      artist_id: profile.id,
      name: dto.name,
      description: dto.description,
      location: dto.location,
      banner_url: banner_url ?? undefined,
      logo_url: logo_url ?? undefined,
    } as Partial<Shop>);
    return this.shopsRepo.save(shop);
  }

  async findByArtist(artistId: number) {
    return this.shopsRepo.find({ where: { artist_id: artistId } });
  }

  async findByUserId(userId: number) {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) return [];
    return this.shopsRepo.find({ where: { artist_id: profile.id } });
  }

  async findById(id: number) {
    const shop = await this.shopsRepo.findOne({
      where: { id },
      relations: ['artist'],
    });
    if (!shop) throw new NotFoundException('Boutique introuvable');
    return shop;
  }

  async update(
    id: number,
    dto: UpdateShopDto,
    userId: number,
    files: { banner?: Express.Multer.File[]; logo?: Express.Multer.File[] },
  ) {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new ForbiddenException('Accès interdit');

    const shop = await this.shopsRepo.findOne({
      where: { id, artist_id: profile.id },
    });
    if (!shop) throw new NotFoundException('Boutique introuvable');

    if (dto.name !== undefined) shop.name = dto.name;
    if (dto.description !== undefined) shop.description = dto.description;
    if (dto.location !== undefined) shop.location = dto.location;

    if (files.banner?.[0]) {
      if (shop.banner_url) await this.minioService.deleteFile(shop.banner_url);
      shop.banner_url = await this.minioService.uploadFile(files.banner[0]);
    }
    if (files.logo?.[0]) {
      if (shop.logo_url) await this.minioService.deleteFile(shop.logo_url);
      shop.logo_url = await this.minioService.uploadFile(files.logo[0]);
    }

    return this.shopsRepo.save(shop);
  }

  async remove(id: number, userId: number) {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new ForbiddenException('Accès interdit');

    const shop = await this.shopsRepo.findOne({
      where: { id, artist_id: profile.id },
    });
    if (!shop) throw new NotFoundException('Boutique introuvable');

    if (shop.banner_url) await this.minioService.deleteFile(shop.banner_url);
    if (shop.logo_url) await this.minioService.deleteFile(shop.logo_url);

    await this.shopsRepo.remove(shop);
    return { message: 'Boutique supprimée' };
  }
}
