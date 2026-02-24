/**
 * Enable Server Features for Testing
 * 
 * Initializes test environment with Keycloak realm setup
 */

const keycloakModule = require('@keycloak/keycloak-admin-client');
const config = require('../helpers/config');

// The KeycloakAdminClient is the default export
const KeycloakAdminClient = keycloakModule.default || keycloakModule.KeycloakAdminClient;

let adminClient;
let realm;

async function getAdminClient() {
  if (!adminClient) {
    const kcConfig = config.getKeycloakConfig();
    
    // For HTTPS with self-signed certificates, disable certificate verification
    // This is only for testing - never do this in production
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    adminClient = new KeycloakAdminClient({
      baseUrl: kcConfig.baseUrl,
      realmName: 'master',
      requestConfig: {
        // For self-signed certificates
        rejectUnauthorized: false,
      },
    });
    
    // Authenticate with admin credentials
    await adminClient.auth({
      username: 'admin',
      password: 'admin',
      clientId: 'admin-cli',
      grantType: 'password',
    });
  }
  
  return adminClient;
}

async function initializeRealm() {
  if (realm) {
    return realm;
  }
  
  const client = await getAdminClient();
  
  // Create test realm if it doesn't exist
  const realms = await client.realms.find();
  const testRealmExists = realms.some(r => r.realm === 'express-middleware-test');
  
  if (!testRealmExists) {
    realm = await client.realms.create({
      realm: 'express-middleware-test',
      enabled: true,
      displayName: 'Express Middleware Test Realm',
    });
  } else {
    realm = realms.find(r => r.realm === 'express-middleware-test');
  }
  
  return realm;
}

async function createTestClient() {
  const client = await getAdminClient();
  const realmName = 'express-middleware-test';
  
  // Check if test client already exists
  const existingClients = await client.clients.find({
    realm: realmName,
    clientId: 'express-middleware-test-client',
  });
  
  if (existingClients.length > 0) {
    return existingClients[0];
  }
  
  // Create new test client
  const clientData = await client.clients.create({
    realm: realmName,
    clientId: 'express-middleware-test-client',
    enabled: true,
    publicClient: false,
    directAccessGrantsEnabled: true,
    serviceAccountsEnabled: true,
    standardFlowEnabled: true,
    implicitFlowEnabled: true,
    redirectUris: [
      'http://localhost:3000/auth/callback',
      'http://localhost:3000/*'
    ],
    webOrigins: ['http://localhost:3000'],
  });
  
  return clientData;
}

/**
 * Main initialization function
 */
async function enableServerFeatures() {
  try {
    // Initialize realm and test client
    await initializeRealm();
    await createTestClient();
    
    return {
      adminClient,
      realm,
    };
  } catch (error) {
    console.error('Error enabling server features:', error);
    throw error;
  }
}

module.exports = {
  enableServerFeatures,
  getAdminClient,
  initializeRealm,
  createTestClient,
};
