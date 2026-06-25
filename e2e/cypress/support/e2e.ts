import './commands';

Cypress.on('uncaught:exception', () => false);

beforeEach(() => {
  cy.clearCookies();
});
