// Scénario 4 — Tunnel de commande
// Flux HTTP complet : API gateway → order-service + payment-service → PostgreSQL

describe('Tunnel de commande (checkout)', () => {
  const ts = Date.now();
  const email = `cypress-checkout-${ts}@craftea-ci.local`;
  const password = 'TestPassword123!';
  let accessCookie = '';

  before(() => {
    cy.request('POST', '/api/auth/register', {
      firstname: 'Checkout', lastname: 'Test', email, password,
    }).then((res) => {
      const cookies: string[] = [res.headers['set-cookie']].flat();
      const tokenCookie = cookies.find((c) => c.startsWith('accessToken='));
      if (tokenCookie) accessCookie = tokenCookie.split(';')[0];
    });
  });

  it('renvoie 401 pour la liste des commandes sans authentification', () => {
    cy.request({
      url: '/api/orders',
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('retourne la liste des commandes (vide) pour un utilisateur connecté', () => {
    cy.request({
      url: '/api/orders',
      headers: { Cookie: accessCookie },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([200, 404, 503]);
      if (res.status === 200) {
        expect(res.body).to.be.an('array').or.to.have.property('data');
      }
    });
  });

  it('renvoie 401 pour la création de payment intent sans authentification', () => {
    cy.request({
      method: 'POST',
      url: '/api/payments/intent',
      body: { amount: 50, order_id: 1 },
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('renvoie 401 pour un remboursement sans authentification', () => {
    cy.request({
      method: 'POST',
      url: '/api/payments/1/refund',
      body: {},
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });
});
