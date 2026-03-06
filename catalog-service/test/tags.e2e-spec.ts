import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { TagsModule } from '../src/tags/tags.module';
import { Tag } from '../src/tags/entities/tag.entity';
import { Product } from '../src/products/entities/product.entity';
import { ProductImage } from '../src/products/entities/product-image.entity';
import { Category } from '../src/categories/entities/category.entity';

const JWT_SECRET = 'test-secret';

describe('TagsController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let adminToken: string;
  let userToken: string;

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
          entities: [Tag, Product, ProductImage, Category],
          synchronize: true,
        }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        TagsModule,
      ],
      providers: [JwtStrategy],
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

  // ---------- POST /api/tags ----------

  it('POST /api/tags — admin should create a tag', () => {
    return request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Fait-main' })
      .expect(201)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.name).toBe('Fait-main');
      });
  });

  it('POST /api/tags — should reject non-admin', () => {
    return request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Bio' })
      .expect(403);
  });

  it('POST /api/tags — should reject empty body', () => {
    return request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  // ---------- GET /api/tags ----------

  it('GET /api/tags — should return all tags (public)', async () => {
    // Create a second tag
    await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Artisanal' });

    return request(app.getHttpServer())
      .get('/api/tags')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThanOrEqual(2);
        // Should be sorted by name ASC
        const names = res.body.map((t: any) => t.name);
        const sorted = [...names].sort();
        expect(names).toEqual(sorted);
      });
  });

  // ---------- DELETE /api/tags/:id ----------

  it('DELETE /api/tags/:id — admin should delete a tag', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'ToRemove' });

    return request(app.getHttpServer())
      .delete(`/api/tags/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({ message: 'Tag supprimé' });
      });
  });

  it('DELETE /api/tags/9999 — should 404', () => {
    return request(app.getHttpServer())
      .delete('/api/tags/9999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('DELETE /api/tags/:id — should reject non-admin', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/tags')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Protected' });

    return request(app.getHttpServer())
      .delete(`/api/tags/${created.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});
