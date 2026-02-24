/**
 * Test Suite for OIDC Methods
 * 
 * Tests for generateAuthorizationUrl(), login(), and loginPKCE()
 * 
 * To run these tests:
 * npm test
 * 
 * Or with mocha directly:
 * npx mocha test/oidc-methods.test.js
 */

const assert = require('assert');
const crypto = require('crypto');

// Mock class that simulates keycloakExpressMiddleware with OIDC methods
class MockKeycloakExpressMiddleware {
  constructor(authServerUrl, realmName, clientId, clientSecret) {
    this.authServerUrl = authServerUrl;
    this.realmName = realmName;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }
}

// Helper: Base64url encode
function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Load OIDC methods
const oidcMethods = require('../oidc-methods.js');

// Bind methods to mock class prototype
MockKeycloakExpressMiddleware.prototype.generateAuthorizationUrl = oidcMethods.generateAuthorizationUrl;
MockKeycloakExpressMiddleware.prototype.loginWithCredentials = oidcMethods.loginWithCredentials;
MockKeycloakExpressMiddleware.prototype.loginPKCE = oidcMethods.loginPKCE;

describe('OIDC Methods', function() {
  let adapter;

  beforeEach(function() {
    adapter = new MockKeycloakExpressMiddleware(
      'https://keycloak.example.com/',
      'my-realm',
      'my-client',
      'my-secret'
    );
  });

  describe('generateAuthorizationUrl()', function() {
    it('should generate authorization URL with all required parameters', function() {
      const result = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback'
      });

      assert(result.authUrl, 'authUrl should exist');
      assert(result.state, 'state should exist');
      assert(result.codeVerifier, 'codeVerifier should exist');

      assert(result.authUrl.includes('client_id=my-client'), 'should contain client_id');
      assert(result.authUrl.includes('code_challenge='), 'should contain code_challenge');
      assert(result.authUrl.includes('code_challenge_method=S256'), 'should contain S256');
      assert(result.authUrl.includes('response_type=code'), 'should contain response_type');
      assert(result.authUrl.includes('scope=openid+profile+email'), 'should contain default scope');
      assert(result.authUrl.includes(`state=${result.state}`), 'should contain state');
    });

    it('should generate different PKCE pairs on each call', function() {
      const result1 = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback'
      });

      const result2 = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback'
      });

      assert.notStrictEqual(result1.state, result2.state, 'state should be different');
      assert.notStrictEqual(result1.codeVerifier, result2.codeVerifier, 'codeVerifier should be different');
    });

    it('should accept custom scope', function() {
      const result = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback',
        scope: 'openid offline_access'
      });

      assert(result.authUrl.includes('scope=openid+offline_access'), 'should contain custom scope');
    });

    it('should accept redirectUri as camelCase alias', function() {
      const result = adapter.generateAuthorizationUrl({
        redirectUri: 'https://app.example.com/callback'
      });

      assert(result.authUrl, 'should work with camelCase');
      assert(result.authUrl.includes('redirect_uri=https'), 'should contain redirect_uri');
    });

    it('should accept custom state', function() {
      const customState = 'my-custom-state-123';
      const result = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback',
        state: customState
      });

      assert.strictEqual(result.state, customState, 'should use custom state');
      assert(result.authUrl.includes(`state=${customState}`), 'should contain custom state in URL');
    });

    it('should throw error if redirect_uri is missing', function() {
      assert.throws(
        () => adapter.generateAuthorizationUrl({}),
        /redirect_uri/,
        'should throw error about redirect_uri'
      );
    });

    it('should throw error if adapter is not configured', function() {
      const unconfigured = new MockKeycloakExpressMiddleware(null, null, null);

      assert.throws(
        () => unconfigured.generateAuthorizationUrl({
          redirect_uri: 'https://app.example.com/callback'
        }),
        /initialized/,
        'should throw error about initialization'
      );
    });

    it('code_verifier should be 128+ characters (base64url encoded)', function() {
      const result = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback'
      });

      assert(result.codeVerifier.length >= 127, 'codeVerifier should be at least 127 chars');
    });

    it('code_challenge should be valid base64url (no +, /, =)', function() {
      const result = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback'
      });

      const urlParams = new URL(result.authUrl).searchParams;
      const codeChallenge = urlParams.get('code_challenge');

      assert(!codeChallenge.includes('+'), 'codeChallenge should not contain +');
      assert(!codeChallenge.includes('/'), 'codeChallenge should not contain /');
      assert(!codeChallenge.includes('='), 'codeChallenge should not contain =');
    });

    it('code_challenge should be SHA256 of code_verifier', function() {
      const result = adapter.generateAuthorizationUrl({
        redirect_uri: 'https://app.example.com/callback'
      });

      const urlParams = new URL(result.authUrl).searchParams;
      const codeChallenge = urlParams.get('code_challenge');

      // Manually compute what it should be
      const expectedChallenge = base64url(
        crypto.createHash('sha256').update(result.codeVerifier).digest()
      );

      assert.strictEqual(codeChallenge, expectedChallenge, 'code_challenge should be SHA256 of verifier');
    });
  });

  describe('loginWithCredentials()', function() {
    it('should throw error if adapter not configured', async function() {
      const unconfigured = new MockKeycloakExpressMiddleware(null, null, null);

      try {
        await unconfigured.loginWithCredentials({ grant_type: 'client_credentials' });
        assert.fail('should have thrown error');
      } catch (error) {
        assert(error.message.includes('initialized'), 'should mention initialization');
      }
    });

    it('should construct body with provided credentials', async function() {
      // Mock fetch to capture request
      const originalFetch = global.fetch;
      let capturedRequest = null;

      global.fetch = async (url, options) => {
        capturedRequest = {
          url,
          options,
          body: new URLSearchParams(options.body)
        };

        return {
          ok: true,
          text: async () => JSON.stringify({
            access_token: 'test-token',
            expires_in: 300
          })
        };
      };

      try {
        await adapter.loginWithCredentials({
          grant_type: 'client_credentials',
          scope: 'openid'
        });

        assert(capturedRequest.url.includes('token'), 'should call token endpoint');
        assert(capturedRequest.body.get('grant_type') === 'client_credentials', 'should include grant_type');
        assert(capturedRequest.body.get('scope') === 'openid', 'should include scope');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should auto-append clientId if not provided in credentials', async function() {
      const originalFetch = global.fetch;
      let capturedBody = null;

      global.fetch = async (url, options) => {
        capturedBody = new URLSearchParams(options.body);

        return {
          ok: true,
          text: async () => JSON.stringify({
            access_token: 'test-token'
          })
        };
      };

      try {
        await adapter.loginWithCredentials({ grant_type: 'password', username: 'user', password: 'pass' });

        assert(capturedBody.get('client_id') === 'my-client', 'should auto-append clientId');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should auto-append clientSecret if not provided in credentials', async function() {
      const originalFetch = global.fetch;
      let capturedBody = null;

      global.fetch = async (url, options) => {
        capturedBody = new URLSearchParams(options.body);

        return {
          ok: true,
          text: async () => JSON.stringify({
            access_token: 'test-token'
          })
        };
      };

      try {
        await adapter.loginWithCredentials({ grant_type: 'client_credentials' });

        assert(capturedBody.get('client_secret') === 'my-secret', 'should auto-append clientSecret');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should handle successful token response', async function() {
      const originalFetch = global.fetch;

      global.fetch = async () => {
        return {
          ok: true,
          text: async () => JSON.stringify({
            access_token: 'jwt-token-123',
            refresh_token: 'refresh-token-456',
            expires_in: 300,
            token_type: 'Bearer'
          })
        };
      };

      try {
        const result = await adapter.loginWithCredentials({ grant_type: 'client_credentials' });

        assert.strictEqual(result.access_token, 'jwt-token-123');
        assert.strictEqual(result.refresh_token, 'refresh-token-456');
        assert.strictEqual(result.expires_in, 300);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should throw error on failed token response', async function() {
      const originalFetch = global.fetch;

      global.fetch = async () => {
        return {
          ok: false,
          text: async () => JSON.stringify({
            error: 'invalid_client',
            error_description: 'Invalid client credentials'
          })
        };
      };

      try {
        await adapter.loginWithCredentials({ grant_type: 'client_credentials' });
        assert.fail('should have thrown error');
      } catch (error) {
        assert(error.message.includes('Invalid client'), 'should include error description');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('loginPKCE()', function() {
    it('should throw error if code is missing', async function() {
      try {
        await adapter.loginPKCE({
          redirect_uri: 'https://app.example.com/callback',
          code_verifier: 'verifier-123'
        });
        assert.fail('should have thrown error');
      } catch (error) {
        assert(error.message.includes('code'), 'should mention code');
      }
    });

    it('should throw error if redirect_uri is missing', async function() {
      try {
        await adapter.loginPKCE({
          code: 'auth-code-123',
          code_verifier: 'verifier-123'
        });
        assert.fail('should have thrown error');
      } catch (error) {
        assert(error.message.includes('redirect_uri'), 'should mention redirect_uri');
      }
    });

    it('should throw error if code_verifier is missing', async function() {
      try {
        await adapter.loginPKCE({
          code: 'auth-code-123',
          redirect_uri: 'https://app.example.com/callback'
        });
        assert.fail('should have thrown error');
      } catch (error) {
        assert(error.message.includes('code_verifier'), 'should mention code_verifier');
      }
    });

    it('should accept camelCase aliases', async function() {
      const originalFetch = global.fetch;
      let capturedBody = null;

      global.fetch = async (url, options) => {
        capturedBody = new URLSearchParams(options.body);

        return {
          ok: true,
          text: async () => JSON.stringify({
            access_token: 'test-token'
          })
        };
      };

      try {
        await adapter.loginPKCE({
          code: 'auth-code-123',
          redirectUri: 'https://app.example.com/callback',
          codeVerifier: 'verifier-123'
        });

        assert(capturedBody.get('grant_type') === 'authorization_code', 'should set correct grant_type');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should include all required parameters in request', async function() {
      const originalFetch = global.fetch;
      let capturedBody = null;

      global.fetch = async (url, options) => {
        capturedBody = new URLSearchParams(options.body);

        return {
          ok: true,
          text: async () => JSON.stringify({
            access_token: 'test-token'
          })
        };
      };

      try {
        await adapter.loginPKCE({
          code: 'auth-code-123',
          redirect_uri: 'https://app.example.com/callback',
          code_verifier: 'verifier-123'
        });

        assert.strictEqual(capturedBody.get('grant_type'), 'authorization_code');
        assert.strictEqual(capturedBody.get('code'), 'auth-code-123');
        assert.strictEqual(capturedBody.get('redirect_uri'), 'https://app.example.com/callback');
        assert.strictEqual(capturedBody.get('code_verifier'), 'verifier-123');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
