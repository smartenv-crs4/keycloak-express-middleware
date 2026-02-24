
/**
 * Global Test Setup - Mocha Hooks using rootHooks
 * 
 * This file is loaded ONCE before all test suites run (configured in .mocharc.json)
 * 
 * Purpose:
 * - Enables server features (realm, client initialization)
 * - Sets up shared test infrastructure
 * - Configures global test utilities
 */

const { enableServerFeatures } = require('./enableServerFeatures');
const config = require('../helpers/config');

exports.mochaHooks = {
  async beforeAll() {
    this.timeout(60000);
    
    
    try {
      // Initialize server features (realm, clients, etc.)
      const features = await enableServerFeatures();
      
      // Store in global for access in tests
      global.testContext = {
        adminClient: features.adminClient,
        realm: features.realm,
      };
      
      console.log('✓ Server features enabled\n');
    } catch (err) {
      console.error('✗ Failed to enable server features:', err.message);
      throw err;
    }
  },

  async afterAll() {
    if (global.testContext && global.testContext.adminClient) {
      try {
      } catch (err) {
          // ...existing code...
      }
    }
  }
};

/**
 * Global error handler for uncaught exceptions
 */
process.on('unhandledRejection', (reason, promise) => {
  console.error('\n❌ Unhandled Promise Rejection:', reason);
  process.exit(1);
});
