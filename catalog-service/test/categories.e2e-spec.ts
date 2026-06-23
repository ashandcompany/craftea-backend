import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { CategoriesController } from '../src/categories/categories.controller';
import { CategoriesService } from '../src/categories/categories.service';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { ProductImage } from '../src/products/entities/product-image.entity';
import { Tag } from '../src/tags/entities/tag.entity';
import { RedisService } from '../src/redis/redis.service';

const JWT_SECRET = 'test-secret';

describe('CategoriesController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;

  // Stub RedisService — no real Redis needed
  const redisStub = {
    getCache: jest.fn().mockResolvedValue(null),
    setCache: jest.fn().mockResolvedValue(undefined),
    invalidateCache: jest.fn().mockResolvedValue(undefined),
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
          entities: [Category, Product, ProductImage, Tag],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Category]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
      ],
      controllers: [CategoriesController],
      providers: [
        CategoriesService,
        { provide: RedisService, useValue: redisStub },
        JwtStrategy,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    adminToken = jwtService.sign({ id: 1, role: 'admin' });
    userToken = jwtService.sign({ id: 2, role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- POST /api/categories ----------

  it('POST /api/categories — admin should create a category', () => {
    return request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bijoux', description: 'Handmade jewelry' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Bijoux');
        expect(res.body.icon).toBe('Package');
      });
  });

  it('POST /api/categories — should reject non-admin user', () => {
    return request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Céramique' })
      .expect(403);
  });

  it('POST /api/categories — should reject missing name', () => {
    return request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'no name' })
      .expect(400);
  });

  // ---------- GET /api/categories ----------

  it('GET /api/categories — should return all categories (public)', () => {
    return request(app.getHttpServer())
      .get('/api/categories')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(1);
      });
  });

  // ---------- GET /api/categories/:id ----------

  it('GET /api/categories/:id — should return a category', async () => {
    // Create one first
    const created = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Poterie' });

    return request(app.getHttpServer())
      .get(`/api/categories/${created.body.id}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Poterie');
      });
  });

  it('GET /api/categories/9999 — should 404', () => {
    return request(app.getHttpServer())
      .get('/api/categories/9999')
      .expect(404);
  });

  // ---------- PUT /api/categories/:id ----------

  it('PUT /api/categories/:id — admin should update', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bois' });

    return request(app.getHttpServer())
      .put(`/api/categories/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Bois flotté', icon: 'Tree' })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe('Bois flotté');
        expect(res.body.icon).toBe('Tree');
      });
  });

  // ---------- DELETE /api/categories/:id ----------

  it('DELETE /api/categories/:id — admin should delete', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToDelete' });

    return request(app.getHttpServer())
      .delete(`/api/categories/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ message: 'Catégorie supprimée' });
      });
  });

  it('DELETE /api/categories/9999 — should 404', () => {
    return request(app.getHttpServer())
      .delete('/api/categories/9999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
