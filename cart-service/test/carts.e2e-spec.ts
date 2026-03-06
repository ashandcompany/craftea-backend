import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CartsModule } from '../src/carts/carts.module';
import { Cart } from '../src/carts/entities/cart.entity';
import { CartItem } from '../src/carts/entities/cart-item.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';

const JWT_SECRET = 'test-secret';

describe('CartsController (integration)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let token: string;
  const userId = 1;

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
          entities: [Cart, CartItem],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Cart, CartItem]),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret: JWT_SECRET, signOptions: { expiresIn: '1h' } }),
        CartsModule,
      ],
      providers: [JwtStrategy],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    token = jwtService.sign({ id: userId, role: 'user' });
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- GET /api/cart ----------

  it('GET /api/cart — should create and return empty cart', () => {
    return request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('id');
        expect(res.body.user_id).toBe(userId);
        expect(res.body.items).toEqual([]);
      });
  });

  it('GET /api/cart — should return 401 without token', () => {
    return request(app.getHttpServer()).get('/api/cart').expect(401);
  });

  // ---------- POST /api/cart/items ----------

  it('POST /api/cart/items — should add item to cart', () => {
    return request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 42, quantity: 2 })
      .expect(201)
      .expect((res) => {
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].product_id).toBe(42);
        expect(res.body.items[0].quantity).toBe(2);
      });
  });

  it('POST /api/cart/items — should increment quantity for duplicate product', () => {
    return request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 42, quantity: 3 })
      .expect(201)
      .expect((res) => {
        expect(res.body.items).toHaveLength(1);
        expect(res.body.items[0].quantity).toBe(5);
      });
  });

  it('POST /api/cart/items — should reject invalid body', () => {
    return request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 'abc' })
      .expect(400);
  });

  // ---------- PATCH /api/cart/items/:itemId ----------

  it('PATCH /api/cart/items/:id — should update item quantity', async () => {
    // First find the item id
    const cart = await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);
    const itemId = cart.body.items[0].id;

    return request(app.getHttpServer())
      .patch(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 10 })
      .expect(200)
      .expect((res) => {
        expect(res.body.items[0].quantity).toBe(10);
      });
  });

  it('PATCH /api/cart/items/9999 — should 404 for non-existent item', () => {
    return request(app.getHttpServer())
      .patch('/api/cart/items/9999')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 1 })
      .expect(404);
  });

  // ---------- DELETE /api/cart/items/:itemId ----------

  it('DELETE /api/cart/items/:id — should remove item from cart', async () => {
    const cart = await request(app.getHttpServer())
      .get('/api/cart')
      .set('Authorization', `Bearer ${token}`);
    const itemId = cart.body.items[0].id;

    return request(app.getHttpServer())
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toHaveLength(0);
      });
  });

  // ---------- DELETE /api/cart ----------

  it('DELETE /api/cart — should clear the cart', async () => {
    // Add items first
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 1, quantity: 1 });
    await request(app.getHttpServer())
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ product_id: 2, quantity: 3 });

    return request(app.getHttpServer())
      .delete('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.items).toHaveLength(0);
      });
  });
});
