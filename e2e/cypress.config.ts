import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    // En CI : pointe l'api-gateway (port 3001)
    // En local avec frontend : changer pour http://localhost:3000
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:3001',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 15000,
    responseTimeout: 15000,
    retries: {
      runMode: 2,
      openMode: 0,
    },
    env: {
      apiUrl: process.env.CYPRESS_API_URL || 'http://localhost:3001',
    },
  },
});
