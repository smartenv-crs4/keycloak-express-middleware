const assert = require('assert');
const fetch = require('node-fetch');
const KeycloakExpressMiddleware = require('../index.js');
const config = require('./helpers/config').getKeycloakConfig();

// Helper to get tokens via loginWithCredentials
async function getToken(keycloak, username, password) {
  return keycloak.loginWithCredentials({
    grant_type: 'password',
    username,
    password
  });
}

describe('Keycloak Integration - All Methods', function() {
  let keycloak;
  let tokens;

  before(async function() {
    keycloak = new KeycloakExpressMiddleware(
      { use: () => {} },
      {
        'auth-server-url': config.baseUrl.replace(/\/$/, '') + '/',
        realm: config.realm,
        resource: config.clientId,
        credentials: { secret: config.clientSecret }
      }
    );
    // Get tokens for a test user
    tokens = await getToken(keycloak, config.testUser, config.testPassword);
    assert(tokens.access_token, 'Should obtain access_token');
  });

  it('should generate authorization URL (PKCE)', function() {
    const result = keycloak.generateAuthorizationUrl({
      redirect_uri: 'https://localhost/callback'
    });
    assert(result.authUrl.includes('code_challenge'), 'Should include PKCE params');
    assert(result.codeVerifier.length > 40, 'Should generate codeVerifier');
    assert(result.state.length > 10, 'Should generate state');
  });

  it('should login with credentials (password grant)', async function() {
    const resp = await keycloak.loginWithCredentials({
      grant_type: 'password',
      username: config.testUser,
      password: config.testPassword
    });
    assert(resp.access_token, 'Should get access_token');
  });

  it('should fail login with wrong credentials', async function() {
    try {
      await keycloak.loginWithCredentials({
        grant_type: 'password',
        username: config.testUser,
        password: 'wrongpassword'
      });
      assert.fail('Should throw error');
    } catch (e) {
      assert(
        e.message.includes('invalid_grant') ||
        e.message.includes('Authentication failed') ||
        e.message.includes('invalid_client') ||
        e.message.includes('Invalid user credentials')
      );
    }
  });

  it('should exchange code for tokens (loginPKCE)', async function() {
    // Simulate PKCE flow: generate code_verifier, code_challenge, state
    const { authUrl, codeVerifier, state } = keycloak.generateAuthorizationUrl({
      redirect_uri: 'https://localhost/callback'
    });
    // This part would require browser automation to complete the flow.
    // For now, just check that the method throws if required params are missing.
    await assert.rejects(
      () => keycloak.loginPKCE({}),
      /loginPKCE requires "code"/i
    );
  });

  // Add more tests for middleware and utility methods as needed
});
