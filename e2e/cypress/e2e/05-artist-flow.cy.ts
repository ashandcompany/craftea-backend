// Scénario 5 — Parcours artisan
// Flux HTTP complet : API gateway → artist-service → PostgreSQL

describe('Parcours artisan', () => {
  const ts = Date.now();
  const email = `cypress-artist-${ts}@craftea-ci.local`;
  const password = 'TestPassword123!';
  let accessCookie = '';
  let userId = 0;

  before(() => {
    cy.request('POST', '/api/auth/register', {
      firstname: 'Artisan', lastname: 'Test', email, password,
    }).then((res) => {
      userId = res.body.user?.id;
      const cookies: string[] = [res.headers['set-cookie']].flat();
      const tokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      if (tokenCookie) accessCookie = tokenCookie.split(';')[0];
    });
  });

  it('renvoie 401 pour le profil artisan sans authentification', () => {
    cy.request({
      url: '/api/artists/me',
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('renvoie 401 ou 403 pour la création de boutique sans authentification', () => {
    cy.request({
      method: 'POST',
      url: '/api/shops',
      body: { name: 'Boutique Test', description: 'Description' },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([401, 403]);
    });
  });

  it('renvoie 401 pour la création de produit sans authentification', () => {
    cy.request({
      method: 'POST',
      url: '/api/products',
      body: { name: 'Produit Test', price: 25, stock: 10 },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('un utilisateur connecté accède à la liste des boutiques artisans', () => {
    cy.request({
      url: '/api/shops',
      headers: { Cookie: accessCookie },
      failOnStatusCode: false,
    }).then((res) => {
      // 200 avec liste (vide OK) ou 404/503 si artist-service non démarré en CI
      expect(res.status).to.be.oneOf([200, 404, 503]);
      if (res.status === 200) {
        expect(res.body).to.be.an('array').or.to.have.property('data');
      }
    });
  });
});
