import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { Tag } from '../tags/entities/tag.entity';
import { MinioService } from '../minio/minio.service';
import { RedisService } from '../redis/redis.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

describe('ProductsService', () => {
  let service: ProductsService;
  let productsRepo: Record<string, jest.Mock>;
  let imagesRepo: Record<string, jest.Mock>;
  let tagsRepo: Record<string, jest.Mock>;
  let minioService: Record<string, jest.Mock>;
  let redis: Record<string, jest.Mock>;
  let rabbitmq: Record<string, jest.Mock>;

  const mockProduct = {
    id: 1,
    shop_id: 10,
    title: 'Vase artisanal',
    description: 'Beau vase',
    price: 29.99,
    stock: 5,
    is_active: true,
    category_id: 1,
    images: [],
    tags: [],
    category: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as unknown as Product;

  beforeEach(async () => {
    productsRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    imagesRepo = {
      create: jest.fn((r) => r),
      save: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    tagsRepo = {
      find: jest.fn(),
    };
    minioService = {
      uploadFile: jest.fn(),
      deleteFile: jest.fn(),
      objectNameFromUrl: jest.fn(),
    };
    redis = {
      getCache: jest.fn(),
      setCache: jest.fn(),
      invalidateCache: jest.fn(),
    };
    rabbitmq = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productsRepo },
        { provide: getRepositoryToken(ProductImage), useValue: imagesRepo },
        { provide: getRepositoryToken(Tag), useValue: tagsRepo },
        { provide: MinioService, useValue: minioService },
        { provide: RedisService, useValue: redis },
        { provide: RabbitmqService, useValue: rabbitmq },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  // ---------- create ----------

  describe('create', () => {
    it('should create product, upload images, assign tags, and publish event', async () => {
      const dto = {
        shop_id: 10,
        title: 'Vase',
        price: 29.99,
        stock: 5,
        tags: [1, 2],
      } as any;
      const files = [
        { originalname: 'img.jpg', buffer: Buffer.from('x') },
      ] as Express.Multer.File[];

      const created = { ...mockProduct, id: 1, tags: [] };
      productsRepo.create.mockReturnValue(created);
      productsRepo.save.mockResolvedValue(created);
      minioService.uploadFile.mockResolvedValue('abc-123.jpg');
      tagsRepo.find.mockResolvedValue([{ id: 1, name: 'Bio' }, { id: 2, name: 'Éco' }]);
      productsRepo.findOne.mockResolvedValue({ ...created, images: [{ id: 1, image_url: 'abc-123.jpg', position: 0 }], tags: [{ id: 1 }, { id: 2 }] });

      const result = await service.create(dto, files);

      expect(productsRepo.create).toHaveBeenCalled();
      expect(productsRepo.save).toHaveBeenCalled();
      expect(minioService.uploadFile).toHaveBeenCalledWith(files[0]);
      expect(imagesRepo.save).toHaveBeenCalled();
      expect(tagsRepo.find).toHaveBeenCalled();
      expect(redis.invalidateCache).toHaveBeenCalledWith('products:list:*');
      expect(rabbitmq.publish).toHaveBeenCalledWith(
        'product.created',
        expect.objectContaining({ id: 1, shop_id: 10 }),
      );
      expect(result).toBeDefined();
    });

    it('should create product without images or tags', async () => {
      const dto = { shop_id: 10, title: 'Bol', price: 15 } as any;
      const created = { ...mockProduct, id: 2, title: 'Bol' };
      productsRepo.create.mockReturnValue(created);
      productsRepo.save.mockResolvedValue(created);
      productsRepo.findOne.mockResolvedValue(created);

      const result = await service.create(dto, []);

      expect(minioService.uploadFile).not.toHaveBeenCalled();
      expect(tagsRepo.find).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  // ---------- findAll ----------

  describe('findAll', () => {
    it('should return paginated products with default params', async () => {
      const rows = [mockProduct];
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([rows, 1]),
      };
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({});

      expect(result).toEqual({ total: 1, page: 1, limit: 20, data: rows });
      expect(qb.andWhere).toHaveBeenCalledWith('product.is_active = :active', { active: true });
    });

    it('should apply category_id filter', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ category_id: 5 });

      expect(qb.andWhere).toHaveBeenCalledWith('product.category_id = :catId', { catId: 5 });
    });

    it('should apply search filter with ILIKE', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ search: 'vase' });

      expect(qb.andWhere).toHaveBeenCalledWith('product.title ILIKE :search', { search: '%vase%' });
    });

    it('should skip is_active filter when include_inactive is true', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      productsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ include_inactive: 'true' });

      expect(qb.andWhere).not.toHaveBeenCalledWith(
        'product.is_active = :active',
        expect.anything(),
      );
    });
  });

  // ---------- findById ----------

  describe('findById', () => {
    it('should return a product with relations', async () => {
      productsRepo.findOne.mockResolvedValue(mockProduct);

      const result = await service.findById(1);
      expect(result).toBe(mockProduct);
      expect(productsRepo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: ['images', 'tags', 'category'],
        order: { images: { position: 'ASC' } },
      });
    });

    it('should throw NotFoundException when product not found', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- toggleActive ----------

  describe('toggleActive', () => {
    it('should toggle is_active from true to false', async () => {
      const product = { ...mockProduct, is_active: true };
      productsRepo.findOne.mockResolvedValue(product);
      productsRepo.save.mockResolvedValue({ ...product, is_active: false });

      const result = await service.toggleActive(1);

      expect(product.is_active).toBe(false);
      expect(redis.invalidateCache).toHaveBeenCalledWith('products:1');
      expect(result).toEqual({ id: 1, is_active: false });
    });

    it('should throw NotFoundException when product not found', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleActive(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- updateStock ----------

  describe('updateStock', () => {
    it('should set stock to the given value', async () => {
      const product = { ...mockProduct, stock: 5 };
      productsRepo.findOne.mockResolvedValue(product);
      productsRepo.save.mockResolvedValue({ ...product, stock: 20 });

      const result = await service.updateStock(1, 20);

      expect(product.stock).toBe(20);
      expect(redis.invalidateCache).toHaveBeenCalledWith('products:1');
      expect(result).toEqual({ id: 1, stock: 20 });
    });

    it('should throw NotFoundException when product not found', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.updateStock(999, 10)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- decrementStock ----------

  describe('decrementStock', () => {
    it('should decrement stock by quantity', async () => {
      const product = { ...mockProduct, stock: 10 };
      productsRepo.findOne.mockResolvedValue(product);
      productsRepo.save.mockResolvedValue({ ...product, stock: 7 });

      const result = await service.decrementStock(1, 3);

      expect(product.stock).toBe(7);
      expect(result).toEqual({ id: 1, stock: 7 });
    });

    it('should throw BadRequestException when stock is insufficient', async () => {
      const product = { ...mockProduct, stock: 2 };
      productsRepo.findOne.mockResolvedValue(product);

      await expect(service.decrementStock(1, 5)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when product not found', async () => {
      productsRepo.findOne.mockResolvedValue(null);

      await expect(service.decrementStock(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  // ---------- remove ----------

  describe('remove', () => {
    it('should delete images from minio, DB, and publish event', async () => {
      const images = [
        { id: 1, image_url: 'http://minio/bucket/abc.jpg', product_id: 1 },
      ] as ProductImage[];
      imagesRepo.find.mockResolvedValue(images);
      minioService.objectNameFromUrl.mockReturnValue('abc.jpg');
      imagesRepo.delete.mockResolvedValue({ affected: 1 });
      productsRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.remove(1);

      expect(minioService.deleteFile).toHaveBeenCalledWith('http://minio/bucket/abc.jpg');
      expect(redis.invalidateCache).toHaveBeenCalledWith('img:abc.jpg');
      expect(imagesRepo.delete).toHaveBeenCalledWith({ product_id: 1 });
      expect(productsRepo.delete).toHaveBeenCalledWith(1);
      expect(rabbitmq.publish).toHaveBeenCalledWith('product.deleted', { id: 1 });
      expect(result).toEqual({ message: 'Produit supprimé' });
    });

    it('should throw NotFoundException when product not found', async () => {
      imagesRepo.find.mockResolvedValue([]);
      imagesRepo.delete.mockResolvedValue({ affected: 0 });
      productsRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });
});
