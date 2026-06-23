import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Product } from './entities/product.entity.js';
import { ProductImage } from './entities/product-image.entity.js';
import { Tag } from '../tags/entities/tag.entity.js';
import { MinioService } from '../minio/minio.service.js';
import { RedisService } from '../redis/redis.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { QueryProductDto } from './dto/query-product.dto.js';
import { RabbitmqService, ProductEvent } from '../rabbitmq/rabbitmq.service.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ProductImage) private imagesRepo: Repository<ProductImage>,
    @InjectRepository(Tag) private tagsRepo: Repository<Tag>,
    private minioService: MinioService,
    private redis: RedisService,
    private rabbitmq: RabbitmqService,
  ) {}

  async create(dto: CreateProductDto, files: Express.Multer.File[]) {
    const variants = dto.variants?.length ? dto.variants : null;
    const computedStock = variants
      ? variants.reduce((s, v) => s + v.options.reduce((os, o) => os + o.stock, 0), 0)
      : (dto.stock ?? 0);

    const product = this.productsRepo.create({
      shop_id: dto.shop_id,
      category_id: dto.category_id,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      stock: computedStock,
      variants,
      processing_time_min: dto.processing_time_min,
      processing_time_max: dto.processing_time_max,
      processing_time_unit: dto.processing_time_unit,
      delivery_time_min: dto.delivery_time_min,
      delivery_time_max: dto.delivery_time_max,
      delivery_time_unit: dto.delivery_time_unit,
      shipping_fee: dto.shipping_fee ?? null,
    });
    await this.productsRepo.save(product);

    // Upload images
    if (files?.length) {
      const imgRecords: Partial<ProductImage>[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await this.minioService.uploadFile(files[i]);
        imgRecords.push({ product_id: product.id, image_url: url, position: i });
      }
      await this.imagesRepo.save(imgRecords.map((r) => this.imagesRepo.create(r)));
    }

    // Assign tags
    if (dto.tags?.length) {
      const tags = await this.tagsRepo.find({ where: { id: In(dto.tags) } });
      product.tags = tags;
      await this.productsRepo.save(product);
    }

    await this.redis.invalidateCache('products:list:*');

    const saved = await this.findByIdFull(product.id);

    await this.rabbitmq.publish(ProductEvent.CREATED, {
      id: saved.id,
      shop_id: saved.shop_id,
      title: saved.title,
      price: Number(saved.price),
      stock: saved.stock,
      category_id: saved.category_id,
    });

    return saved;
  }

  async findAll(query: QueryProductDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    // Step 1 — count + paginated IDs on the bare table (no relation JOINs)
    // to avoid the TypeORM skip/take bug with leftJoinAndSelect.
    const idsQb = this.productsRepo
      .createQueryBuilder('product')
      .select('product.id', 'id');

    if (query.include_inactive !== 'true') {
      idsQb.andWhere('product.is_active = :active', { active: true });
    }
    if (query.category_id) {
      idsQb.andWhere('product.category_id = :catId', { catId: query.category_id });
    }
    if (query.shop_id) {
      idsQb.andWhere('product.shop_id = :shopId', { shopId: query.shop_id });
    }
    if (query.search) {
      idsQb.andWhere('product.title ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.tag) {
      // Join only for filtering, no select
      idsQb
        .innerJoin('product.tags', 'tag_filter')
        .andWhere('tag_filter.id = :tagId', { tagId: query.tag });
    }

    idsQb.orderBy('product.created_at', 'DESC');

    const total = await idsQb.getCount();

    const rawIds = await idsQb.offset(offset).limit(limit).getRawMany<{ id: number }>();
    const ids = rawIds.map((r) => Number(r.id));

    if (ids.length === 0) {
      return { total, page, limit, data: [] };
    }

    // Step 2 — load full entities with relations for the selected IDs only
    const rows = await this.productsRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.tags', 'tags')
      .where('product.id IN (:...ids)', { ids })
      .orderBy('product.created_at', 'DESC')
      .addOrderBy('images.position', 'ASC')
      .getMany();

    return { total, page, limit, data: rows };
  }

  async findById(id: number) {
    return this.findByIdFull(id);
  }

  private async findByIdFull(id: number) {
    const product = await this.productsRepo.findOne({
      where: { id },
      relations: ['images', 'tags', 'category'],
      order: { images: { position: 'ASC' } },
    });
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  async update(id: number, dto: UpdateProductDto, files: Express.Multer.File[]) {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable');

    // Update scalar fields
    const fields: (keyof UpdateProductDto)[] = [
      'title', 'description', 'price', 'stock', 'category_id',
      'is_active', 'processing_time_min', 'processing_time_max', 'processing_time_unit', 'delivery_time_min', 'delivery_time_max', 'delivery_time_unit', 'shipping_fee',
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) (product as any)[f] = dto[f];
    }

    // Handle variants
    if (dto.variants !== undefined) {
      const variants = dto.variants?.length ? dto.variants : null;
      product.variants = variants;
      if (variants) {
        product.stock = variants.reduce((s, v) => s + v.options.reduce((os, o) => os + o.stock, 0), 0);
      }
    }

    await this.productsRepo.save(product);

    // Delete images
    if (dto.images_to_delete?.length) {
      const toRemove = await this.imagesRepo.find({
        where: { id: In(dto.images_to_delete), product_id: product.id },
      });
      for (const img of toRemove) {
        await this.minioService.deleteFile(img.image_url);
        const objName = this.minioService.objectNameFromUrl(img.image_url);
        if (objName) await this.redis.invalidateCache(`img:${objName}`);
      }
      await this.imagesRepo.delete({ id: In(dto.images_to_delete), product_id: product.id });
    }

    // Upload new images
    if (files?.length) {
      const maxPos =
        (await this.imagesRepo
          .createQueryBuilder('img')
          .select('MAX(img.position)', 'max')
          .where('img.product_id = :pid', { pid: product.id })
          .getRawOne()
        )?.max || 0;

      for (let i = 0; i < files.length; i++) {
        const url = await this.minioService.uploadFile(files[i]);
        await this.imagesRepo.save(
          this.imagesRepo.create({
            product_id: product.id,
            image_url: url,
            position: maxPos + i + 1,
          }),
        );
      }
    }

    // Reorder images
    if (dto.image_order?.length) {
      for (let i = 0; i < dto.image_order.length; i++) {
        await this.imagesRepo.update(
          { id: dto.image_order[i], product_id: product.id },
          { position: i },
        );
      }
    }

    // Update tags
    if (dto.tags) {
      const tags = await this.tagsRepo.find({ where: { id: In(dto.tags) } });
      product.tags = tags;
      await this.productsRepo.save(product);
    }

    await this.redis.invalidateCache(`products:${product.id}`);
    await this.redis.invalidateCache('products:list:*');

    const updated = await this.findByIdFull(product.id);

    await this.rabbitmq.publish(ProductEvent.UPDATED, {
      id: updated.id,
      shop_id: updated.shop_id,
      title: updated.title,
      price: Number(updated.price),
      stock: updated.stock,
      category_id: updated.category_id,
      is_active: updated.is_active,
    });

    return updated;
  }

  async toggleActive(id: number) {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable');

    product.is_active = !product.is_active;
    await this.productsRepo.save(product);

    await this.redis.invalidateCache(`products:${product.id}`);
    await this.redis.invalidateCache('products:list:*');

    return { id: product.id, is_active: product.is_active };
  }

  async updateStock(id: number, stock: number) {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable');

    product.stock = stock;
    await this.productsRepo.save(product);

    await this.redis.invalidateCache(`products:${product.id}`);
    await this.redis.invalidateCache('products:list:*');

    return { id: product.id, stock: product.stock };
  }

  async decrementStock(id: number, quantity: number, selectedOptions?: Record<string, string>) {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable');

    if (selectedOptions && product.variants && product.variants.length > 0) {
      for (const [variantName, optionLabel] of Object.entries(selectedOptions)) {
        const variant = product.variants.find((v) => v.name === variantName);
        if (!variant) continue;
        const option = variant.options.find((o) => o.label === optionLabel);
        if (!option) continue;
        if (option.stock < quantity) {
          throw new BadRequestException(
            `Stock insuffisant pour l'option "${optionLabel}" (dispo: ${option.stock}, demandé: ${quantity})`,
          );
        }
        option.stock -= quantity;
      }
      product.stock = product.variants.reduce(
        (s, v) => s + v.options.reduce((os, o) => os + o.stock, 0), 0,
      );
    } else {
      if (product.stock < quantity) {
        throw new BadRequestException(
          `Stock insuffisant pour le produit ${id} (dispo: ${product.stock}, demandé: ${quantity})`,
        );
      }
      product.stock -= quantity;
    }

    await this.productsRepo.save(product);

    await this.redis.invalidateCache(`products:${product.id}`);
    await this.redis.invalidateCache('products:list:*');

    return { id: product.id, stock: product.stock };
  }

  async remove(id: number) {
    const images = await this.imagesRepo.find({ where: { product_id: id } });
    for (const img of images) {
      await this.minioService.deleteFile(img.image_url);
      const objName = this.minioService.objectNameFromUrl(img.image_url);
      if (objName) await this.redis.invalidateCache(`img:${objName}`);
    }

    await this.imagesRepo.delete({ product_id: id });
    const result = await this.productsRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('Produit introuvable');

    await this.redis.invalidateCache(`products:${id}`);
    await this.redis.invalidateCache('products:list:*');

    await this.rabbitmq.publish(ProductEvent.DELETED, { id });

    return { message: 'Produit supprimé' };
  }
}
