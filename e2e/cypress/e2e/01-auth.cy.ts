// Scénario 1 — Inscription + Connexion
// Flux HTTP complet : API gateway → user-service → PostgreSQL

describe('Authentification (inscription & connexion)', () => {
  const ts = Date.now();
  const email = `cypress-auth-${ts}@craftea-ci.local`;
  const password = 'TestPassword123!';

  it('inscrit un nouvel utilisateur et retourne son profil sans mot de passe', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/register',
      body: { firstname: 'Cypress', lastname: 'Test', email, password },
    }).then((res) => {
      expect(res.status).to.eq(201);
      expect(res.body.user).to.exist;
      expect(res.body.user.email).to.eq(email);
      expect(res.body.user.password).to.be.undefined;
      expect(res.headers['set-cookie']).to.exist;
    });
  });

  it('rejette une inscription avec un email invalide (400)', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/register',
      body: { firstname: 'Bad', lastname: 'Email', email: 'pas-un-email', password },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
    });
  });

  it('connecte un utilisateur existant et pose les cookies JWT', () => {
    const loginEmail = `cypress-login-${ts}@craftea-ci.local`;

    cy.request('POST', '/api/auth/register', {
      firstname: 'Login', lastname: 'Test', email: loginEmail, password,
    });

    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email: loginEmail, password },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.user.email).to.eq(loginEmail);
      const cookies: string[] = [res.headers['set-cookie']].flat();
      expect(cookies.some((c) => c.startsWith('accessToken='))).to.be.true;
    });
  });

  it('renvoie 401 avec un mauvais mot de passe', () => {
    cy.request({
      method: 'POST',
      url: '/api/auth/login',
      body: { email, password: 'MauvaisMotDePasse!' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });
});
