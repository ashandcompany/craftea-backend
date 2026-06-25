// Commandes personnalisées Craftea

Cypress.Commands.add('apiRegister', (user: {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
}) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/auth/register`,
    body: user,
    failOnStatusCode: false,
  });
});

Cypress.Commands.add('apiLogin', (email: string, password: string) => {
  return cy.request({
    method: 'POST',
    url: `${Cypress.env('apiUrl')}/api/auth/login`,
    body: { email, password },
    failOnStatusCode: false,
  });
});

// Crée et connecte un utilisateur de test unique par suite
Cypress.Commands.add('createAndLoginUser', (suffix = '') => {
  const ts = Date.now();
  const email = `e2e-${suffix}-${ts}@craftea-ci.local`;
  const password = 'TestPassword123!';
  const user = { firstname: 'E2E', lastname: 'Test', email, password };

  return cy.apiRegister(user).then(() => {
    cy.apiLogin(email, password);
    return cy.wrap({ ...user });
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      apiRegister(user: {
        firstname: string;
        lastname: string;
        email: string;
        password: string;
      }): Chainable<Cypress.Response<unknown>>;
      apiLogin(email: string, password: string): Chainable<Cypress.Response<unknown>>;
      createAndLoginUser(suffix?: string): Chainable<{
        firstname: string;
        lastname: string;
        email: string;
        password: string;
      }>;
    }
  }
}
