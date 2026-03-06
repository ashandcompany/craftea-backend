import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { ProductsController } from '../src/products/products.controller';
import { ProductsService } from '../src/products/products.service';
import { Product } from '../src/products/entities/product.entity';
import { ProductImage } from '../src/products/entities/product-image.entity';
import { Tag } from '../src/tags/entities/tag.entity';
import { Category } from '../src/categories/entities/category.entity';
import { MinioService } from '../src/minio/minio.service';
import { RedisService } from '../src/redis/redis.service';
import { RabbitmqService } from '../src/rabbitmq/rabbitmq.service';

const JWT_SECRET = 'test-secret';

describe('ProductsController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let artistToken: string;
  let adminToken: string;

  const minioStub = {
    uploadFile: jest.fn().mockResolvedValue('test-image.jpg'),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    objectNameFromUrl: jest.fn().mockReturnValue('test-image.jpg'),
  };
  const redisStub = {
    getCache: jest.fn().mockResolvedValue(null),
    setCache: jest.fn().mockResolvedValue(undefined),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
  };
  const rabbitmqStub = {
    publish: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [() => ({ JWT_SECRET })],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [Product, ProductImage, Tag, Category],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Product, ProductImage, Tag]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [ProductsController],
      providers: [
        ProductsService,
        { provide: MinioService, useValue: minioStub },
        { provide: RedisService, useValue: redisStub },
        { provide: RabbitmqService, useValue: rabbitmqStub },
        JwtStrategy,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    artistToken = jwtService.sign({ id: 1, role: 'artist' });
    adminToken = jwtService.sign({ id: 2, role: 'admin' });
  });

  afterAll(async () => {
    await app.close();
  });

  let createdProductId: number;

  // ---------- POST /api/products ----------

  it('POST /api/products — artist should create a product', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${artistToken}`)
      .field('shop_id', '10')
      .field('title', 'Vase artisanal')
      .field('price', '29.99')
      .field('stock', '5')
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.title).toBe('Vase artisanal');
        expect(res.body.shop_id).toBe(10);
        createdProductId = res.body.id;
      });
  });

  it('POST /api/products — should reject unauthenticated request', () => {
    return request(app.getHttpServer())
      .post('/api/products')
      .field('shop_id', '10')
      .field('title', 'Test')
      .expect(401);
  });

  // ---------- GET /api/products ----------

  it('GET /api/products — should return paginated list', () => {
    return request(app.getHttpServer())
      .get('/api/products')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('total');
        expect(res.body).toHaveProperty('page');
        expect(res.body).toHaveProperty('data');
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  // ---------- GET /api/products/:id ----------

  it('GET /api/products/:id — should return a product', () => {
    return request(app.getHttpServer())
      .get(`/api/products/${createdProductId}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(createdProductId);
        expect(res.body.title).toBe('Vase artisanal');
      });
  });

  it('GET /api/products/9999 — should 404', () => {
    return request(app.getHttpServer())
      .get('/api/products/9999')
      .expect(404);
  });

  // ---------- PATCH /api/products/:id/stock ----------

  it('PATCH /api/products/:id/stock — should update stock', () => {
    return request(app.getHttpServer())
      .patch(`/api/products/${createdProductId}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stock: 20 })
      .expect(200)
      .expect((res) => {
        expect(res.body.stock).toBe(20);
      });
  });

  // ---------- PATCH /api/products/:id/decrement-stock ----------

  it('PATCH /api/products/:id/decrement-stock — should decrement', () => {
    return request(app.getHttpServer())
      .patch(`/api/products/${createdProductId}/decrement-stock`)
      .send({ quantity: 3 })
      .expect(200)
      .expect((res) => {
        expect(res.body.stock).toBe(17);
      });
  });

  it('PATCH /api/products/:id/decrement-stock — should 400 if insufficient', () => {
    return request(app.getHttpServer())
      .patch(`/api/products/${createdProductId}/decrement-stock`)
      .send({ quantity: 999 })
      .expect(400);
  });

  // ---------- PATCH /api/products/:id/toggle-active ----------

  it('PATCH /api/products/:id/toggle-active — should toggle is_active', () => {
    return request(app.getHttpServer())
      .patch(`/api/products/${createdProductId}/toggle-active`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.is_active).toBe(false);
      });
  });

  // ---------- DELETE /api/products/:id ----------

  it('DELETE /api/products/:id — admin should delete', () => {
    return request(app.getHttpServer())
      .delete(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ message: 'Produit supprimé' });
      });
  });

  it('DELETE /api/products/9999 — should 404', () => {
    return request(app.getHttpServer())
      .delete('/api/products/9999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
