import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShopsController } from '../src/shops/shops.controller';
import { ShopsService } from '../src/shops/shops.service';
import { Shop } from '../src/shops/entities/shop.entity';
import { ShopShippingProfile, ShippingZone } from '../src/shops/entities/shop-shipping-profile.entity';
import { ShopShippingMethod } from '../src/shops/entities/shop-shipping-method.entity';
import { ArtistProfile } from '../src/artists/entities/artist-profile.entity';
import { MinioService } from '../src/minio/minio.service';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';

// ─── Helpers ──────────────────────────────────────────────────────────

const mockArtistProfile = {
  id: 1,
  user_id: 100,
  bio: 'Artist bio',
  banner_url: null,
  logo_url: null,
  social_links: null,
  validated: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  shops: [],
};

const mockShop = {
  id: 10,
  artist_id: 1,
  name: 'Test Shop',
  description: 'A workshop',
  location: 'Paris',
  banner_url: 'shop-banner.jpg',
  logo_url: 'shop-logo.jpg',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  artist: mockArtistProfile,
};

const mockShippingProfile = {
  id: 1,
  shop_id: 10,
  zone: ShippingZone.FRANCE,
  base_fee: 5.0,
  additional_item_fee: 1.5,
  free_shipping_threshold: 50,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const mockShippingMethod = {
  id: 1,
  shop_id: 10,
  name: 'Colissimo',
  zones: ['france'],
  delivery_time_min: 2,
  delivery_time_max: 5,
  delivery_time_unit: 'days',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
};

const mockMinioService = {
  uploadFile: jest.fn().mockResolvedValue('uploaded-file.jpg'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
};

const mockShopsRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockShippingRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockMethodsRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockArtistsRepository = {
  findOne: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────

describe('ShopsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  function signToken(payload: { id: number; role: string }): string {
    return jwtService.sign(payload);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
      ],
      controllers: [ShopsController],
      providers: [
        ShopsService,
        {
          provide: getRepositoryToken(Shop),
          useValue: mockShopsRepository,
        },
        {
          provide: getRepositoryToken(ShopShippingProfile),
          useValue: mockShippingRepository,
        },
        {
          provide: getRepositoryToken(ShopShippingMethod),
          useValue: mockMethodsRepository,
        },
        {
          provide: getRepositoryToken(ArtistProfile),
          useValue: mockArtistsRepository,
        },
        {
          provide: MinioService,
          useValue: mockMinioService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Public routes ─────────────────────────────────────────────────

  describe('GET /api/shops/:id', () => {
    it('should return a shop by ID', async () => {
      mockShopsRepository.findOne.mockResolvedValue(mockShop);

      const res = await request(app.getHttpServer())
        .get('/api/shops/10')
        .expect(200);

      expect(res.body.name).toBe('Test Shop');
      expect(res.body.artist).toBeDefined();
    });

    it('should return 404 for non-existing shop', async () => {
      mockShopsRepository.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/shops/999')
        .expect(404);
    });

    it('should return 400 for invalid ID', async () => {
      await request(app.getHttpServer())
        .get('/api/shops/abc')
        .expect(400);
    });
  });

  describe('GET /api/shops/artist/:artistId', () => {
    it('should return shops for an artist', async () => {
      mockShopsRepository.find.mockResolvedValue([mockShop]);

      const res = await request(app.getHttpServer())
        .get('/api/shops/artist/1')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe('Test Shop');
    });

    it('should return empty array when artist has no shops', async () => {
      mockShopsRepository.find.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/shops/artist/1')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/shops/user/:userId', () => {
    it('should return shops for a user', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.find.mockResolvedValue([mockShop]);

      const res = await request(app.getHttpServer())
        .get('/api/shops/user/100')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe('Test Shop');
    });

    it('should return empty array when user has no artist profile', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .get('/api/shops/user/999')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  // ─── Protected CRUD routes ─────────────────────────────────────────

  describe('POST /api/shops', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/shops')
        .send({ name: 'New Shop' })
        .expect(401);
    });

    it('should return 403 for non-artist role', async () => {
      const token = signToken({ id: 100, role: 'user' });

      await request(app.getHttpServer())
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Shop' })
        .expect(403);
    });

    it('should create a shop', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      const created = { ...mockShop, name: 'New Shop' };
      mockShopsRepository.create.mockReturnValue(created);
      mockShopsRepository.save.mockResolvedValue(created);
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Shop', description: 'Great place', location: 'Lyon' })
        .expect(201);

      expect(res.body.name).toBe('New Shop');
    });

    it('should return 400 if user has no artist profile', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 200, role: 'artist' });

      await request(app.getHttpServer())
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Shop' })
        .expect(400);
    });

    it('should handle file uploads on create', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      const created = { ...mockShop, banner_url: 'uploaded-file.jpg' };
      mockShopsRepository.create.mockReturnValue(created);
      mockShopsRepository.save.mockResolvedValue(created);
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .post('/api/shops')
        .set('Authorization', `Bearer ${token}`)
        .field('name', 'Photo Shop')
        .attach('banner', Buffer.from('fake-img'), 'banner.jpg')
        .expect(201);

      expect(mockMinioService.uploadFile).toHaveBeenCalled();
      expect(res.body.banner_url).toBe('uploaded-file.jpg');
    });
  });

  describe('PUT /api/shops/:id', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .put('/api/shops/10')
        .send({ name: 'Updated' })
        .expect(401);
    });

    it('should update a shop', async () => {
      const existing = { ...mockShop };
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(existing);
      mockShopsRepository.save.mockResolvedValue({ ...existing, name: 'Updated Shop' });
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .put('/api/shops/10')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Shop' })
        .expect(200);

      expect(res.body.name).toBe('Updated Shop');
    });

    it('should return 404 if shop not owned by artist', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 100, role: 'artist' });

      await request(app.getHttpServer())
        .put('/api/shops/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should return 403 if user has no artist profile', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 200, role: 'artist' });

      await request(app.getHttpServer())
        .put('/api/shops/10')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' })
        .expect(403);
    });

    it('should handle banner upload on update', async () => {
      const existing = { ...mockShop };
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(existing);
      mockShopsRepository.save.mockResolvedValue({
        ...existing,
        banner_url: 'uploaded-file.jpg',
      });
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .put('/api/shops/10')
        .set('Authorization', `Bearer ${token}`)
        .field('name', 'Updated Shop')
        .attach('banner', Buffer.from('new-banner'), 'new-banner.jpg')
        .expect(200);

      expect(mockMinioService.deleteFile).toHaveBeenCalledWith('shop-banner.jpg');
      expect(mockMinioService.uploadFile).toHaveBeenCalled();
      expect(res.body.banner_url).toBe('uploaded-file.jpg');
    });
  });

  describe('DELETE /api/shops/:id', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .delete('/api/shops/10')
        .expect(401);
    });

    it('should delete a shop', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(mockShop);
      mockShopsRepository.remove.mockResolvedValue(mockShop);
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .delete('/api/shops/10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ message: 'Boutique supprimée' });
      expect(mockMinioService.deleteFile).toHaveBeenCalledWith('shop-banner.jpg');
      expect(mockMinioService.deleteFile).toHaveBeenCalledWith('shop-logo.jpg');
    });

    it('should return 404 if shop not found or not owned', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 100, role: 'artist' });

      await request(app.getHttpServer())
        .delete('/api/shops/999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─── Shipping profiles ─────────────────────────────────────────────

  describe('GET /api/shops/:id/shipping', () => {
    it('should return shipping profiles for a shop', async () => {
      mockShopsRepository.findOne.mockResolvedValue(mockShop);
      mockShippingRepository.find.mockResolvedValue([mockShippingProfile]);

      const res = await request(app.getHttpServer())
        .get('/api/shops/10/shipping')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].zone).toBe('france');
    });

    it('should return 404 if shop not found', async () => {
      mockShopsRepository.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/shops/999/shipping')
        .expect(404);
    });
  });

  describe('PUT /api/shops/:id/shipping', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .put('/api/shops/10/shipping')
        .send({ profiles: [] })
        .expect(401);
    });

    it('should update shipping profiles', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(mockShop);
      mockShippingRepository.findOne.mockResolvedValue(null); // no existing
      mockShippingRepository.create.mockReturnValue(mockShippingProfile);
      mockShippingRepository.save.mockResolvedValue(mockShippingProfile);
      mockShippingRepository.delete.mockResolvedValue(undefined);
      mockShippingRepository.find.mockResolvedValue([mockShippingProfile]);

      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .put('/api/shops/10/shipping')
        .set('Authorization', `Bearer ${token}`)
        .send({
          profiles: [
            {
              zone: 'france',
              base_fee: 5.0,
              additional_item_fee: 1.5,
              free_shipping_threshold: 50,
            },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 404 if shop not owned by artist', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 100, role: 'artist' });

      await request(app.getHttpServer())
        .put('/api/shops/10/shipping')
        .set('Authorization', `Bearer ${token}`)
        .send({
          profiles: [
            { zone: 'france', base_fee: 5, additional_item_fee: 1 },
          ],
        })
        .expect(404);
    });
  });

  describe('GET /api/shops/shipping/bulk', () => {
    it('should return shipping profiles for multiple shops', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockShippingProfile]),
      };
      mockShippingRepository.createQueryBuilder.mockReturnValue(qb);

      const res = await request(app.getHttpServer())
        .get('/api/shops/shipping/bulk?ids=10,20')
        .expect(200);

      expect(res.body).toBeDefined();
      expect(res.body['10']).toBeDefined();
    });

    it('should return empty object when no ids', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shops/shipping/bulk?ids=')
        .expect(200);

      expect(res.body).toEqual({});
    });
  });

  // ─── Shipping methods ──────────────────────────────────────────────

  describe('GET /api/shops/:id/shipping-methods', () => {
    it('should return shipping methods for a shop', async () => {
      mockShopsRepository.findOne.mockResolvedValue(mockShop);
      mockMethodsRepository.find.mockResolvedValue([mockShippingMethod]);

      const res = await request(app.getHttpServer())
        .get('/api/shops/10/shipping-methods')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe('Colissimo');
    });

    it('should return 404 if shop not found', async () => {
      mockShopsRepository.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/shops/999/shipping-methods')
        .expect(404);
    });
  });

  describe('PUT /api/shops/:id/shipping-methods', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .put('/api/shops/10/shipping-methods')
        .send({ methods: [] })
        .expect(401);
    });

    it('should update shipping methods', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(mockShop);
      mockMethodsRepository.find.mockResolvedValue([]); // no existing
      mockMethodsRepository.create.mockReturnValue(mockShippingMethod);
      mockMethodsRepository.save.mockResolvedValue(mockShippingMethod);
      // Mock for the final getShippingMethods re-fetch
      mockShopsRepository.findOne.mockResolvedValue(mockShop);
      mockMethodsRepository.find.mockResolvedValue([mockShippingMethod]);

      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .put('/api/shops/10/shipping-methods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          methods: [
            {
              name: 'Colissimo',
              zones: ['france'],
              delivery_time_min: 2,
              delivery_time_max: 5,
              delivery_time_unit: 'days',
            },
          ],
        })
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return 404 if shop not owned by artist', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      mockShopsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 100, role: 'artist' });

      await request(app.getHttpServer())
        .put('/api/shops/10/shipping-methods')
        .set('Authorization', `Bearer ${token}`)
        .send({
          methods: [
            { name: 'Test', zones: ['france'] },
          ],
        })
        .expect(404);
    });
  });

  describe('GET /api/shops/shipping-methods/bulk', () => {
    it('should return shipping methods for multiple shops', async () => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockShippingMethod]),
      };
      mockMethodsRepository.createQueryBuilder.mockReturnValue(qb);

      const res = await request(app.getHttpServer())
        .get('/api/shops/shipping-methods/bulk?ids=10,20')
        .expect(200);

      expect(res.body).toBeDefined();
      expect(res.body['10']).toBeDefined();
    });

    it('should return empty object when no ids', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/shops/shipping-methods/bulk?ids=')
        .expect(200);

      expect(res.body).toEqual({});
    });
  });
});
