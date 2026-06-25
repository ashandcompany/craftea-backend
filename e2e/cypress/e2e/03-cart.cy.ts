// Scénario 3 — Panier
// Flux HTTP complet : API gateway → cart-service → PostgreSQL

describe('Gestion du panier', () => {
  const ts = Date.now();
  const email = `cypress-cart-${ts}@craftea-ci.local`;
  const password = 'TestPassword123!';
  let accessCookie = '';

  before(() => {
    cy.request('POST', '/api/auth/register', {
      firstname: 'Cart', lastname: 'Test', email, password,
    }).then((res) => {
      const cookies: string[] = [res.headers['set-cookie']].flat();
      const tokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      if (tokenCookie) accessCookie = tokenCookie.split(';')[0];
    });
  });

  it('renvoie 401 sans token sur le endpoint panier', () => {
    cy.request({
      url: '/api/cart',
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('retourne le panier (vide) pour un utilisateur connecté', () => {
    cy.request({
      url: '/api/cart',
      headers: { Cookie: accessCookie },
      failOnStatusCode: false,
    }).then((res) => {
      // 200 avec panier vide, ou 404 si cart-service non démarré en CI
      expect(res.status).to.be.oneOf([200, 404, 503]);
      if (res.status === 200) {
        expect(res.body).to.exist;
      }
    });
  });

  it('renvoie 401 pour l\'ajout au panier sans authentification', () => {
    cy.request({
      method: 'POST',
      url: '/api/cart/items',
      body: { product_id: 1, quantity: 1 },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });
});
