import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Shop } from './entities/shop.entity.js';
import { ShopShippingProfile, ShippingZone } from './entities/shop-shipping-profile.entity.js';
import { ShopShippingMethod } from './entities/shop-shipping-method.entity.js';
import { ArtistProfile } from '../artists/entities/artist-profile.entity.js';
import { MinioService } from '../minio/minio.service.js';
import { CreateShopDto } from './dto/create-shop.dto.js';
import { UpdateShopDto } from './dto/update-shop.dto.js';
import { UpdateShippingProfilesDto } from './dto/shipping-profile.dto.js';
import { UpdateShippingMethodsDto } from './dto/shipping-method.dto.js';

@Injectable()
export class ShopsService {
  constructor(
    @InjectRepository(Shop) private shopsRepo: Repository<Shop>,
    @InjectRepository(ShopShippingProfile) private shippingRepo: Repository<ShopShippingProfile>,
    @InjectRepository(ShopShippingMethod) private methodsRepo: Repository<ShopShippingMethod>,
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

    return this.shippingRepo.find({
      where: { shop_id: shopId },
      order: { zone: 'ASC' },
    });
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
    const submittedZones = dto.profiles.map((p) => p.zone);

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

    // Delete profiles for zones that were not submitted (disabled by the user)
    const allZones = Object.values(ShippingZone);
    const disabledZones = allZones.filter((z) => !submittedZones.includes(z));
    if (disabledZones.length > 0) {
      await this.shippingRepo.delete({
        shop_id: shopId,
        zone: In(disabledZones),
      });
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

    for (const id of shopIds) {
      result[id] = profiles.filter((p) => p.shop_id === id);
    }

    return result;
  }

  // ─── Shipping methods (modes de livraison) ──────────────────────────

  async getShippingMethods(shopId: number): Promise<ShopShippingMethod[]> {
    const shop = await this.shopsRepo.findOne({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Boutique introuvable');

    return this.methodsRepo.find({
      where: { shop_id: shopId },
      order: { id: 'ASC' },
    });
  }

  async updateShippingMethods(
    shopId: number,
    dto: UpdateShippingMethodsDto,
    userId: number,
  ): Promise<ShopShippingMethod[]> {
    const profile = await this.artistsRepo.findOne({ where: { user_id: userId } });
    if (!profile) throw new ForbiddenException('Accès interdit');

    const shop = await this.shopsRepo.findOne({
      where: { id: shopId, artist_id: profile.id },
    });
    if (!shop) throw new NotFoundException('Boutique introuvable');

    // Collect IDs sent by the client (existing methods to keep/update)
    const sentIds = dto.methods
      .filter((m) => m.id)
      .map((m) => m.id as number);

    // Delete methods that were removed by the user
    const existing = await this.methodsRepo.find({ where: { shop_id: shopId } });
    const toDelete = existing.filter((e) => !sentIds.includes(e.id));
    if (toDelete.length > 0) {
      await this.methodsRepo.remove(toDelete);
    }

    // Upsert each method
    const results: ShopShippingMethod[] = [];
    for (const m of dto.methods) {
      if (m.id) {
        // Update existing
        const existingMethod = await this.methodsRepo.findOne({
          where: { id: m.id, shop_id: shopId },
        });
        if (existingMethod) {
          existingMethod.name = m.name;
          existingMethod.zones = m.zones;
          existingMethod.delivery_time_min = m.delivery_time_min ?? null;
          existingMethod.delivery_time_max = m.delivery_time_max ?? null;
          existingMethod.delivery_time_unit =
            (m.delivery_time_unit as any) || existingMethod.delivery_time_unit;
          results.push(await this.methodsRepo.save(existingMethod));
        }
      } else {
        // Create new
        const newMethod = this.methodsRepo.create({
          shop_id: shopId,
          name: m.name,
          zones: m.zones,
          delivery_time_min: m.delivery_time_min ?? null,
          delivery_time_max: m.delivery_time_max ?? null,
          delivery_time_unit: (m.delivery_time_unit as any) || 'days',
        });
        results.push(await this.methodsRepo.save(newMethod));
      }
    }

    return this.getShippingMethods(shopId);
  }

  async getShippingMethodsBulk(
    shopIds: number[],
  ): Promise<Record<number, ShopShippingMethod[]>> {
    if (shopIds.length === 0) return {};

    const methods = await this.methodsRepo
      .createQueryBuilder('sm')
      .where('sm.shop_id IN (:...shopIds)', { shopIds })
      .orderBy('sm.shop_id', 'ASC')
      .addOrderBy('sm.id', 'ASC')
      .getMany();

    const result: Record<number, ShopShippingMethod[]> = {};
    for (const id of shopIds) {
      result[id] = methods.filter((m) => m.shop_id === id);
    }
    return result;
  }
}
