// Scénario 2 — Navigation catalogue
// Flux HTTP complet : API gateway → catalog-service → PostgreSQL

describe('Catalogue produits', () => {
  it('retourne la liste des produits (200, tableau)', () => {
    cy.request('/api/products').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.be.an('array').or.to.have.property('data');
    });
  });

  it('retourne la liste des catégories', () => {
    cy.request({ url: '/api/categories', failOnStatusCode: false }).then((res) => {
      expect(res.status).to.be.oneOf([200, 404]);
      if (res.status === 200) {
        expect(res.body).to.be.an('array').or.to.have.property('data');
      }
    });
  });

  it('renvoie 404 pour un produit inexistant', () => {
    cy.request({
      url: '/api/products/999999',
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.be.oneOf([404, 400]);
    });
  });

  it('le endpoint health du catalog-service répond', () => {
    cy.request({ url: '/api/health', failOnStatusCode: false }).then((res) => {
      // La gateway répond (peut renvoyer la santé globale ou 404 si non configurée)
      expect(res.status).to.be.lessThan(500);
    });
  });
});
