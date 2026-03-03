import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Shop } from './entities/shop.entity.js';
import { ShopShippingProfile, ShippingZone } from './entities/shop-shipping-profile.entity.js';
import { ArtistProfile } from '../artists/entities/artist-profile.entity.js';
import { MinioService } from '../minio/minio.service.js';
import { CreateShopDto } from './dto/create-shop.dto.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';
import { UpdateShippingProfilesDto } from './dto/shipping-profile.dto.js';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop) private shopsRepo: Repository<Shop>,
    @InjectRepository(ShopShippingProfile) private shippingRepo: Repository<ShopShippingProfile>,
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

  // ─── Shipping profiles ─────────────────────────────────────────────

  async getShippingProfiles(shopId: number): Promise<ShopShippingProfile[]> {
    const shop = await this.shopsRepo.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique introuvable');

    const profiles = await this.shippingRepo.find({
      where: { shop_id: shopId },
      order: { zone: 'ASC' },
    });

    // Retourner les profils existants, ou des profils par défaut (0€) pour les zones manquantes
    const zones = Object.values(ShippingZone);
    return zones.map(
      (zone) =>
        profiles.find((p) => p.zone === zone) ??
        ({
          id: 0,
          shop_id: shopId,
          zone,
          base_fee: 0,
          additional_item_fee: 0,
          free_shipping_threshold: null,
          created_at: new Date(),
          updated_at: new Date(),
        } as ShopShippingProfile),
    );
  }

  async updateShippingProfiles(
    shopId: number,
    dto: UpdateShippingProfilesDto,
    userId: number,
  ): Promise<ShopShippingProfile[]> {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new ForbiddenException('Accès interdit');

    const shop = await this.shopsRepo.findOne({
      where: { id: shopId, artist_id: profile.id },
    });
    if (!shop) throw new NotFoundException('Boutique introuvable');

    const results: ShopShippingProfile[] = [];

    for (const p of dto.profiles) {
      let existing = await this.shippingRepo.findOne({
        where: { shop_id: shopId, zone: p.zone },
      });

      if (existing) {
        existing.base_fee = p.base_fee;
        existing.additional_item_fee = p.additional_item_fee;
        existing.free_shipping_threshold = p.free_shipping_threshold ?? null;
        results.push(await this.shippingRepo.save(existing));
      } else {
        const newProfile = this.shippingRepo.create({
          shop_id: shopId,
          zone: p.zone,
          base_fee: p.base_fee,
          additional_item_fee: p.additional_item_fee,
          free_shipping_threshold: p.free_shipping_threshold ?? null,
        });
        results.push(await this.shippingRepo.save(newProfile));
      }
    }

    return this.getShippingProfiles(shopId);
  }

  /**
   * Retourne les profils d'expédition pour plusieurs boutiques à la fois.
   */
  async getShippingProfilesBulk(
    shopIds: number[],
  ): Promise<Record<number, ShopShippingProfile[]>> {
    if (shopIds.length === 0) return {};

    const profiles = await this.shippingRepo
      .createQueryBuilder('sp')
      .where('sp.shop_id IN (:...shopIds)', { shopIds })
      .orderBy('sp.shop_id', 'ASC')
      .addOrderBy('sp.zone', 'ASC')
      .getMany();

    const result: Record<number, ShopShippingProfile[]> = {};
    const zones = Object.values(ShippingZone);

    for (const id of shopIds) {
      const shopProfiles = profiles.filter((p) => p.shop_id === id);
      result[id] = zones.map(
        (zone) =>
          shopProfiles.find((p) => p.zone === zone) ??
          ({
            id: 0,
            shop_id: id,
            zone,
            base_fee: 0,
            additional_item_fee: 0,
            free_shipping_threshold: null,
            created_at: new Date(),
            updated_at: new Date(),
          } as ShopShippingProfile),
      );
    }

    return result;
  }
}
