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
    const product = this.productsRepo.create({
      shop_id: dto.shop_id,
      category_id: dto.category_id,
      title: dto.title,
      description: dto.description,
      price: dto.price,
      stock: dto.stock,
      creation_time: dto.creation_time,
      delivery_time: dto.delivery_time,
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

    const qb = this.productsRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.tags', 'tags');

    if (query.include_inactive !== 'true') {
      qb.andWhere('product.is_active = :active', { active: true });
    }
    if (query.category_id) {
      qb.andWhere('product.category_id = :catId', { catId: query.category_id });
    }
    if (query.shop_id) {
      qb.andWhere('product.shop_id = :shopId', { shopId: query.shop_id });
    }
    if (query.search) {
      qb.andWhere('product.title ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.tag) {
      qb.andWhere('tags.id = :tagId', { tagId: query.tag });
    }

    qb.orderBy('product.created_at', 'DESC')
      .addOrderBy('images.position', 'ASC')
      .skip(offset)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

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
      'is_active', 'creation_time', 'delivery_time',
    ];
    for (const f of fields) {
      if (dto[f] !== undefined) (product as any)[f] = dto[f];
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

  async decrementStock(id: number, quantity: number) {
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Produit introuvable');

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Stock insuffisant pour le produit ${id} (dispo: ${product.stock}, demandé: ${quantity})`,
      );
    }

    product.stock -= quantity;
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
