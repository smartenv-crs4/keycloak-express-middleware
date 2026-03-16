/**
 * Configuration loader using propertiesmanager
 * 
 * Loads test configuration from config/default.json and config/local.json
 * Supports environment-specific overrides via NODE_ENV
 */

const pmModule = require('propertiesmanager');

// propertiesmanager is a singleton, accessed through .conf
// When NODE_ENV=test, it loads the 'test' block from default.json
const pm = pmModule.conf;

// Export Keycloak test configuration
module.exports = {
  getKeycloakConfig() {
    // Return the whole keycloak block from the active configuration
    if (pm && pm.keycloak) {
      return pm.keycloak;
    }
    // Minimal fallback
    return {
      baseUrl: 'http://localhost:8080',
      realm: 'test-realm',
      clientId: 'test-client',
      clientSecret: 'test-client-secret',
      testUser: 'test-user',
      testPassword: 'test-password',
      adminPassword: 'admin'
    };
  },

  getBaseUrl() {
    const config = this.getKeycloakConfig();
    return config.baseUrl || 'http://localhost:8080';
  },

  getAll() {
    return pm || { keycloak: this.getKeycloakConfig() };
  }
};
