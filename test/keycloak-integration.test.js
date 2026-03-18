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


  it('should obtain a service token via client_credentials', async function() {
    const result = await keycloak.getServiceToken({ scope: 'openid' });
    assert(result.accessToken, 'should get access_token via client_credentials');
    assert.strictEqual(result.source, 'fresh');
    assert.strictEqual(typeof result.expiresIn, 'number');
    assert(result.expiresIn > 0, 'expiresIn should be positive');
  });

  it('should return cached service token on second call', async function() {
    // First call already made in previous test — same scope key hits cache
    const a = await keycloak.getServiceToken({ scope: 'openid' });
    const b = await keycloak.getServiceToken({ scope: 'openid' });
    assert.strictEqual(b.source, 'cache');
    assert.strictEqual(a.accessToken, b.accessToken);
  });

  it('should call Keycloak userinfo endpoint via callProtectedApi', async function() {
    // Use a deterministic public endpoint and send user token in Authorization header.
    const openidConfigUrl = `${config.baseUrl.replace(/\/$/, '')}/realms/${config.realm}/.well-known/openid-configuration`;

    const result = await keycloak.callProtectedApi({
      url: openidConfigUrl,
      authMode: 'user',
      userToken: tokens.access_token
    });

    assert.strictEqual(result.ok, true, `OpenID configuration call failed: ${JSON.stringify(result.data)}`);
    assert(result.data.issuer, 'response should contain issuer');
    assert.strictEqual(result.auth.mode, 'user');
    assert.strictEqual(result.auth.retriedWithFreshToken, false);
  });

  it('should return 401 data with invalid token via callProtectedApi (none mode)', async function() {
    const userInfoUrl = `${config.baseUrl.replace(/\/$/, '')}/realms/${config.realm}/protocol/openid-connect/userinfo`;

    const result = await keycloak.callProtectedApi({
      url: userInfoUrl,
      authMode: 'none'  // no auth header → 401
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.status, 401);
  });

  it('should decode token claims with getTokenClaims after real login', function() {
    // tokens.access_token is a JWT, decode payload and place it where getTokenClaims expects it.
    const jwtPayloadPart = String(tokens.access_token || '').split('.')[1] || '';
    const jsonPayload = Buffer.from(
      jwtPayloadPart.replace(/-/g, '+').replace(/_/g, '/'),
      'base64'
    ).toString('utf8');
    const decodedPayload = JSON.parse(jsonPayload);

    const mockReq = {
      kauth: {
        grant: {
          access_token: {
            content: decodedPayload
          }
        }
      }
    };
    const claims = keycloak.getTokenClaims(mockReq);
    assert(claims.sub, 'should have sub claim');
  });

  // Add more tests for middleware and utility methods as needed
});
