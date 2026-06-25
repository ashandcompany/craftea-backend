import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

// Intégration : HTTP → base de données (craftea_users)
// Nécessite : PostgreSQL accessible via DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME
describe('User Service — intégration (Supertest)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api');
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ── Health ──────────────────────────────────────────────────────────────────

  describe('GET /api/health', () => {
    it('retourne le statut du service', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect({ status: 'ok', service: 'user-service' });
    });
  });

  // ── Inscription ─────────────────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('inscrit un nouvel utilisateur et retourne ses données sans son mot de passe', async () => {
      const email = `int-register-${Date.now()}@craftea-ci.local`;

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          firstname: 'Intégration',
          lastname: 'Test',
          email,
          password: 'TestPassword123!',
        })
        .expect(201);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.body.user.password).toBeUndefined();
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejette un email déjà utilisé', async () => {
      const email = `int-duplicate-${Date.now()}@craftea-ci.local`;
      const payload = {
        firstname: 'Double',
        lastname: 'Test',
        email,
        password: 'TestPassword123!',
      };

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(payload)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(payload)
        .expect(409); // Conflict
    });

    it('rejette un email invalide (400)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          firstname: 'Bad',
          lastname: 'Email',
          email: 'pas-un-email',
          password: 'TestPassword123!',
        })
        .expect(400);
    });

    it('rejette une requête sans champs obligatoires (400)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'only@email.com' })
        .expect(400);
    });
  });

  // ── Connexion ───────────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const email = `int-login-${Date.now()}@craftea-ci.local`;
    const password = 'TestPassword123!';

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ firstname: 'Login', lastname: 'Test', email, password });
    });

    it('connecte l\'utilisateur et pose les cookies JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(email);
      expect(res.headers['set-cookie']).toBeDefined();

      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie']
        : [res.headers['set-cookie']];
      expect(cookies.some((c: string) => c.startsWith('accessToken='))).toBe(true);
    });

    it('renvoie 401 avec un mauvais mot de passe', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: 'MauvaisMotDePasse!' })
        .expect(401);
    });

    it('renvoie 401 avec un email inconnu', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'inconnu@craftea-ci.local', password })
        .expect(401);
    });
  });

  // ── Endpoints protégés ──────────────────────────────────────────────────────

  describe('GET /api/users/:id (protégé)', () => {
    it('renvoie 401 sans token', () => {
      return request(app.getHttpServer())
        .get('/api/users/1')
        .expect(401);
    });

    it('retourne le profil utilisateur avec un token valide', async () => {
      const email = `int-profile-${Date.now()}@craftea-ci.local`;
      const password = 'TestPassword123!';

      const registerRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ firstname: 'Profil', lastname: 'Test', email, password })
        .expect(201);

      const userId: number = registerRes.body.user.id;
      const cookies: string[] = Array.isArray(registerRes.headers['set-cookie'])
        ? registerRes.headers['set-cookie']
        : [registerRes.headers['set-cookie']];

      const profileRes = await request(app.getHttpServer())
        .get(`/api/users/${userId}`)
        .set('Cookie', cookies)
        .expect(200);

      expect(profileRes.body.email).toBe(email);
      expect(profileRes.body.password).toBeUndefined();
    });

    it('renvoie 403 si un utilisateur tente d\'accéder au profil d\'un autre', async () => {
      // Créer deux comptes distincts
      const emailA = `int-userA-${Date.now()}@craftea-ci.local`;
      const emailB = `int-userB-${Date.now() + 1}@craftea-ci.local`;
      const pw = 'TestPassword123!';

      const resA = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ firstname: 'UserA', lastname: 'Test', email: emailA, password: pw })
        .expect(201);

      const resB = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ firstname: 'UserB', lastname: 'Test', email: emailB, password: pw })
        .expect(201);

      const userAId: number = resA.body.user.id;
      const cookiesB: string[] = Array.isArray(resB.headers['set-cookie'])
        ? resB.headers['set-cookie']
        : [resB.headers['set-cookie']];

      // UserB tente d'accéder au profil de UserA → 403
      await request(app.getHttpServer())
        .get(`/api/users/${userAId}`)
        .set('Cookie', cookiesB)
        .expect(403);
    });
  });

  // ── Liste utilisateurs (admin) ──────────────────────────────────────────────

  describe('GET /api/users (admin uniquement)', () => {
    it('renvoie 401 sans token', () => {
      return request(app.getHttpServer())
        .get('/api/users')
        .expect(401);
    });

    it('renvoie 403 pour un utilisateur non-admin', async () => {
      const email = `int-nonadmin-${Date.now()}@craftea-ci.local`;

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ firstname: 'NonAdmin', lastname: 'Test', email, password: 'TestPassword123!' })
        .expect(201);

      const cookies: string[] = Array.isArray(res.headers['set-cookie'])
        ? res.headers['set-cookie']
        : [res.headers['set-cookie']];

      await request(app.getHttpServer())
        .get('/api/users')
        .set('Cookie', cookies)
        .expect(403);
    });
  });
});
