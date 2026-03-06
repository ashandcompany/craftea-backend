import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ArtistsController } from '../src/artists/artists.controller';
import { ArtistsService } from '../src/artists/artists.service';
import { ArtistProfile } from '../src/artists/entities/artist-profile.entity';
import { MinioService } from '../src/minio/minio.service';
import { AuthModule } from '../src/auth/auth.module';
import { ConfigModule } from '@nestjs/config';

// ─── Helpers ──────────────────────────────────────────────────────────

const mockArtistProfile = {
  id: 1,
  user_id: 100,
  bio: 'Test bio',
  banner_url: 'banner-123.jpg',
  logo_url: 'logo-123.jpg',
  social_links: 'https://twitter.com/test',
  validated: true,
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-01'),
  shops: [],
};

const mockMinioService = {
  uploadFile: jest.fn().mockResolvedValue('uploaded-file.jpg'),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  onModuleInit: jest.fn(),
};

const mockArtistsRepository = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

// ─── Test suite ───────────────────────────────────────────────────────

describe('ArtistsController (e2e)', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  function signToken(payload: { id: number; role: string }): string {
    return jwtService.sign(payload);
  }

  beforeAll(async () => {
    // Mock the global fetch used by ArtistsService.fetchUser
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 100, firstname: 'John', lastname: 'Doe' }),
    }) as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        AuthModule,
      ],
      controllers: [ArtistsController],
      providers: [
        ArtistsService,
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
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 100, firstname: 'John', lastname: 'Doe' }),
    });
  });

  // ─── Public routes ─────────────────────────────────────────────────

  describe('GET /api/artists', () => {
    it('should return all validated artist profiles', async () => {
      mockArtistsRepository.find.mockResolvedValue([mockArtistProfile]);

      const res = await request(app.getHttpServer())
        .get('/api/artists')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].bio).toBe('Test bio');
      expect(res.body[0].user).toBeDefined();
      expect(mockArtistsRepository.find).toHaveBeenCalledWith({
        where: { validated: true },
        relations: ['shops'],
      });
    });

    it('should return empty array when no profiles', async () => {
      mockArtistsRepository.find.mockResolvedValue([]);

      const res = await request(app.getHttpServer())
        .get('/api/artists')
        .expect(200);

      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/artists/:id', () => {
    it('should return an artist profile by ID', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);

      const res = await request(app.getHttpServer())
        .get('/api/artists/1')
        .expect(200);

      expect(res.body.bio).toBe('Test bio');
      expect(res.body.user).toBeDefined();
    });

    it('should return 404 for non-existing artist', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/artists/999')
        .expect(404);
    });

    it('should return 400 for invalid ID', async () => {
      await request(app.getHttpServer())
        .get('/api/artists/abc')
        .expect(400);
    });
  });

  // ─── Protected artist routes ───────────────────────────────────────

  describe('GET /api/artists/profile/me', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/artists/profile/me')
        .expect(401);
    });

    it('should return 403 for non-artist role', async () => {
      const token = signToken({ id: 100, role: 'user' });

      await request(app.getHttpServer())
        .get('/api/artists/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return the authenticated artist profile', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .get('/api/artists/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.bio).toBe('Test bio');
      expect(res.body.user).toBeDefined();
    });

    it('should return 404 if artist has no profile', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 200, role: 'artist' });

      await request(app.getHttpServer())
        .get('/api/artists/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('POST /api/artists', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/artists')
        .send({ bio: 'New artist' })
        .expect(401);
    });

    it('should create an artist profile', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null); // no existing profile
      const created = { ...mockArtistProfile, bio: 'New artist' };
      mockArtistsRepository.create.mockReturnValue(created);
      mockArtistsRepository.save.mockResolvedValue(created);
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .post('/api/artists')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'New artist' })
        .expect(201);

      expect(res.body.bio).toBe('New artist');
    });

    it('should return 409 if profile already exists', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(mockArtistProfile);
      const token = signToken({ id: 100, role: 'artist' });

      await request(app.getHttpServer())
        .post('/api/artists')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'Duplicate' })
        .expect(409);
    });

    it('should create profile with file uploads', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);
      const created = { ...mockArtistProfile, banner_url: 'uploaded-file.jpg' };
      mockArtistsRepository.create.mockReturnValue(created);
      mockArtistsRepository.save.mockResolvedValue(created);
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .post('/api/artists')
        .set('Authorization', `Bearer ${token}`)
        .field('bio', 'Artist with banner')
        .attach('banner', Buffer.from('fake-image'), 'banner.jpg')
        .expect(201);

      expect(mockMinioService.uploadFile).toHaveBeenCalled();
      expect(res.body.banner_url).toBe('uploaded-file.jpg');
    });
  });

  describe('PUT /api/artists/profile/me', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .put('/api/artists/profile/me')
        .send({ bio: 'Updated' })
        .expect(401);
    });

    it('should update the artist profile', async () => {
      const existing = { ...mockArtistProfile };
      mockArtistsRepository.findOne.mockResolvedValue(existing);
      mockArtistsRepository.save.mockResolvedValue({
        ...existing,
        bio: 'Updated bio',
      });
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .put('/api/artists/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'Updated bio' })
        .expect(200);

      expect(res.body.bio).toBe('Updated bio');
    });

    it('should return 404 if profile not found', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 999, role: 'artist' });

      await request(app.getHttpServer())
        .put('/api/artists/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ bio: 'Updated bio' })
        .expect(404);
    });

    it('should handle banner upload during update', async () => {
      const existing = { ...mockArtistProfile };
      mockArtistsRepository.findOne.mockResolvedValue(existing);
      mockArtistsRepository.save.mockResolvedValue({
        ...existing,
        banner_url: 'uploaded-file.jpg',
      });
      const token = signToken({ id: 100, role: 'artist' });

      const res = await request(app.getHttpServer())
        .put('/api/artists/profile/me')
        .set('Authorization', `Bearer ${token}`)
        .field('bio', 'Updated bio')
        .attach('banner', Buffer.from('fake-image'), 'new-banner.jpg')
        .expect(200);

      expect(mockMinioService.deleteFile).toHaveBeenCalledWith('banner-123.jpg');
      expect(mockMinioService.uploadFile).toHaveBeenCalled();
      expect(res.body.banner_url).toBe('uploaded-file.jpg');
    });
  });

  // ─── Admin routes ──────────────────────────────────────────────────

  describe('GET /api/artists/admin/all', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/artists/admin/all')
        .expect(401);
    });

    it('should return 403 for non-admin role', async () => {
      const token = signToken({ id: 100, role: 'artist' });

      await request(app.getHttpServer())
        .get('/api/artists/admin/all')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should return all profiles for admin', async () => {
      mockArtistsRepository.find.mockResolvedValue([
        mockArtistProfile,
        { ...mockArtistProfile, id: 2, validated: false },
      ]);
      const token = signToken({ id: 1, role: 'admin' });

      const res = await request(app.getHttpServer())
        .get('/api/artists/admin/all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('PATCH /api/artists/:id/toggle-validation', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/api/artists/1/toggle-validation')
        .expect(401);
    });

    it('should return 403 for non-admin role', async () => {
      const token = signToken({ id: 100, role: 'artist' });

      await request(app.getHttpServer())
        .patch('/api/artists/1/toggle-validation')
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should toggle validation status', async () => {
      const profile = { ...mockArtistProfile, validated: true };
      mockArtistsRepository.findOne.mockResolvedValue(profile);
      mockArtistsRepository.save.mockResolvedValue({ ...profile, validated: false });

      const token = signToken({ id: 1, role: 'admin' });

      const res = await request(app.getHttpServer())
        .patch('/api/artists/1/toggle-validation')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ id: 1, validated: false });
    });

    it('should return 404 for non-existing profile', async () => {
      mockArtistsRepository.findOne.mockResolvedValue(null);
      const token = signToken({ id: 1, role: 'admin' });

      await request(app.getHttpServer())
        .patch('/api/artists/999/toggle-validation')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
