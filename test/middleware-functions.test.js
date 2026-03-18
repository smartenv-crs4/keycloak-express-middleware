const assert = require('assert');
const KeycloakExpressMiddleware = require('../index.js');

function buildAdapter(overrides = {}) {
  const adapter = new KeycloakExpressMiddleware(
    { use: () => {} },
    {
      realm: 'test-realm',
      'auth-server-url': 'https://kc.example.com/',
      resource: 'test-client',
      credentials: { secret: 'test-secret' }
    }
  );
  Object.assign(adapter, {
    ready: true,
    readyQueue: [],
    realmName: 'test-realm',
    authServerUrl: 'https://kc.example.com',
    keycloak: {
      protect: () => (req, res, next) => next(),
      enforcer: () => (req, res, next) => next(),
      logoutUrl: (redirectTo, idToken) => `https://kc.example.com/logout?id_token_hint=${idToken}&redirect_uri=${encodeURIComponent(redirectTo)}`
    }
  }, overrides);
  return adapter;
}

describe('Middleware and Imperative Methods', function() {
  describe('underKeycloakProtection()', function() {
    it('executes callback immediately when adapter is ready', function() {
      const adapter = buildAdapter({ ready: true });
      let called = false;

      adapter.underKeycloakProtection(() => {
        called = true;
      });

      assert.strictEqual(called, true);
    });

    it('queues callback when adapter is not ready', function() {
      const adapter = buildAdapter({ ready: false, readyQueue: [] });
      const cb = () => {};

      adapter.underKeycloakProtection(cb);

      assert.strictEqual(adapter.readyQueue.length, 1);
      assert.strictEqual(adapter.readyQueue[0], cb);
    });
  });

  describe('protectMiddleware()', function() {
    it('delegates directly when conditions is a function', function() {
      let captured;
      const adapter = buildAdapter({
        keycloak: {
          protect: (arg) => {
            captured = arg;
            return (req, res, next) => next();
          }
        }
      });

      const fn = () => true;
      adapter.protectMiddleware(fn);
      assert.strictEqual(captured, fn);
    });

    it('delegates to protect() with no args when conditions missing', function(done) {
      let calledWith;
      const adapter = buildAdapter({
        keycloak: {
          protect: (arg) => {
            calledWith = arg;
            return (req, res, next) => next();
          }
        }
      });

      const mw = adapter.protectMiddleware();
      mw({}, {}, () => {
        assert.strictEqual(calledWith, undefined);
        done();
      });
    });

    it('supports role string/array matching', function(done) {
      let predicate;
      const adapter = buildAdapter({
        keycloak: {
          protect: (arg) => {
            predicate = arg;
            return (req, res, next) => next();
          }
        }
      });

      const mw = adapter.protectMiddleware(['admin', 'realm:writer']);
      mw({}, {}, () => {
        const token = {
          hasRole: (role) => role === 'realm:writer'
        };
        assert.strictEqual(predicate(token), true);
        done();
      });
    });
  });

  describe('customProtectMiddleware()', function() {
    it('computes protection string from req/res', function(done) {
      let capturedRole;
      const adapter = buildAdapter({
        keycloak: {
          protect: (arg) => {
            capturedRole = arg;
            return (req, res, next) => next();
          }
        }
      });

      const mw = adapter.customProtectMiddleware((req) => `role:${req.params.id}`);
      mw({ params: { id: '42' } }, {}, () => {
        assert.strictEqual(capturedRole, 'role:42');
        done();
      });
    });
  });

  describe('encodeTokenRole()', function() {
    it('attaches decoded token to req.encodedTokenRole', function() {
      let captureTokenFn;
      const token = { hasRole: () => true };
      const adapter = buildAdapter({
        keycloak: {
          protect: (arg) => {
            captureTokenFn = arg;
            return (req, res, next) => next();
          }
        }
      });

      const mw = adapter.encodeTokenRole();
      const req = {};
      mw(req, {}, () => {});

      assert.strictEqual(captureTokenFn(token, req), true);
      assert.strictEqual(req.encodedTokenRole, token);
    });
  });

  describe('enforcerMiddleware()', function() {
    it('delegates to keycloak.enforcer for static conditions', function() {
      const expectedMw = () => {};
      let captured = {};
      const adapter = buildAdapter({
        keycloak: {
          enforcer: (conditions, options) => {
            captured = { conditions, options };
            return expectedMw;
          }
        }
      });

      const out = adapter.enforcerMiddleware('perm:read', { response_mode: 'permissions' });
      assert.strictEqual(out, expectedMw);
      assert.deepStrictEqual(captured, {
        conditions: 'perm:read',
        options: { response_mode: 'permissions' }
      });
    });

    it('supports custom permission function and grants access', function(done) {
      const adapter = buildAdapter({
        keycloak: {
          enforcer: () => (req, res, next) => next(),
          protect: () => (req, res, next) => next()
        }
      });

      const mw = adapter.enforcerMiddleware((token, req, cb) => {
        token.hasPermission('any-perm', (allowed) => cb(allowed));
      });

      const req = {};
      const res = { end: () => {} };
      mw(req, res, () => done());
    });

    it('denies access via protect(false) branch when callback is false', function(done) {
      let protectCalled = false;
      const adapter = buildAdapter({
        keycloak: {
          enforcer: () => (req, res, next) => next(),
          protect: () => {
            protectCalled = true;
            return (req, res, next) => next();
          }
        }
      });

      const mw = adapter.enforcerMiddleware((token, req, cb) => cb(false));
      mw({}, { end: () => {} }, () => {
        assert.strictEqual(protectCalled, true);
        done();
      });
    });
  });

  describe('customEnforcerMiddleware()', function() {
    it('computes dynamic permission string and delegates to enforcer', function(done) {
      let captured;
      const adapter = buildAdapter({
        keycloak: {
          enforcer: (perm, options) => {
            captured = { perm, options };
            return (req, res, next) => next();
          }
        }
      });

      const mw = adapter.customEnforcerMiddleware((req) => `resource:${req.params.id}:read`, {
        response_mode: 'token'
      });

      mw({ params: { id: 'abc' } }, {}, () => {
        assert.deepStrictEqual(captured, {
          perm: 'resource:abc:read',
          options: { response_mode: 'token' }
        });
        done();
      });
    });
  });

  describe('encodeTokenPermission()', function() {
    it('attaches hasPermission helper and returns true when enforcer allows', function(done) {
      const adapter = buildAdapter({
        keycloak: {
          enforcer: () => (req, res, next) => next()
        }
      });

      const mw = adapter.encodeTokenPermission();
      const req = {};
      const res = { end: () => {} };

      mw(req, res, () => {
        req.encodedTokenPermission.hasPermission('perm:ok', (ok) => {
          assert.strictEqual(ok, true);
          done();
        });
      });
    });

    it('hasPermission returns false when enforcer triggers res.end', function(done) {
      const adapter = buildAdapter({
        keycloak: {
          enforcer: () => (req, res, next) => res.end('denied')
        }
      });

      const mw = adapter.encodeTokenPermission();
      const req = {};
      const res = { end: () => {} };

      mw(req, res, () => {
        req.encodedTokenPermission.hasPermission('perm:deny', (ok) => {
          assert.strictEqual(ok, false);
          done();
        });
      });
    });
  });

  describe('loginMiddleware()', function() {
    it('returns protect middleware + redirect middleware chain', function(done) {
      let protectCalled = false;
      const adapter = buildAdapter({
        keycloak: {
          protect: () => {
            return (req, res, next) => {
              protectCalled = true;
              next();
            };
          }
        }
      });

      const chain = adapter.loginMiddleware('/home');
      assert(Array.isArray(chain));
      assert.strictEqual(chain.length, 2);

      const res = {
        redirectedTo: null,
        redirect(url) {
          this.redirectedTo = url;
        }
      };

      chain[0]({}, res, () => {
        chain[1]({}, res, () => {});
        assert.strictEqual(protectCalled, true);
        assert.strictEqual(res.redirectedTo, '/home');
        done();
      });
    });
  });

  describe('logoutMiddleware()', function() {
    it('destroys session and redirects to keycloak logout url when id_token exists', function(done) {
      const adapter = buildAdapter({
        keycloak: {
          logoutUrl: (redirectTo, idToken) => `https://kc/logout?token=${idToken}&r=${encodeURIComponent(redirectTo)}`
        }
      });

      const mw = adapter.logoutMiddleware('https://app/home');
      const req = {
        kauth: { grant: { id_token: { token: 'id-token-123' } } },
        session: {
          destroy(cb) {
            cb();
          }
        }
      };
      const res = {
        redirectedTo: null,
        redirect(url) {
          this.redirectedTo = url;
        }
      };

      mw(req, res, () => {});
      assert.strictEqual(
        res.redirectedTo,
        'https://kc/logout?token=id-token-123&r=https%3A%2F%2Fapp%2Fhome'
      );
      done();
    });

    it('redirects directly when id_token is missing', function(done) {
      const adapter = buildAdapter();
      const mw = adapter.logoutMiddleware('/fallback');
      const req = { session: { destroy: () => {} } };
      const res = {
        redirectedTo: null,
        redirect(url) {
          this.redirectedTo = url;
        }
      };

      mw(req, res, () => {});
      assert.strictEqual(res.redirectedTo, '/fallback');
      done();
    });
  });

  describe('login()', function() {
    it('uses protect flow then redirects (browser login style without browser automation)', function(done) {
      const adapter = buildAdapter({
        keycloak: {
          protect: () => (req, res, next) => next()
        }
      });

      const res = {
        redirectedTo: null,
        redirect(url) {
          this.redirectedTo = url;
        }
      };

      adapter.login({}, res, '/dashboard');
      assert.strictEqual(res.redirectedTo, '/dashboard');
      done();
    });
  });

  describe('logout()', function() {
    it('destroys session and redirects to keycloak logout URL when token exists', function(done) {
      const adapter = buildAdapter({
        keycloak: {
          logoutUrl: (redirectTo, idToken) => `https://kc/logout?token=${idToken}&r=${encodeURIComponent(redirectTo)}`
        }
      });

      const req = {
        kauth: { grant: { id_token: { token: 'id-xyz' } } },
        session: {
          destroy(cb) {
            cb();
          }
        }
      };
      const res = {
        redirectedTo: null,
        redirect(url) {
          this.redirectedTo = url;
        }
      };

      adapter.logout(req, res, '/after-logout');
      assert.strictEqual(res.redirectedTo, 'https://kc/logout?token=id-xyz&r=%2Fafter-logout');
      done();
    });

    it('redirects directly when token is missing', function(done) {
      const adapter = buildAdapter();
      const req = { session: { destroy: () => {} } };
      const res = {
        redirectedTo: null,
        redirect(url) {
          this.redirectedTo = url;
        }
      };

      adapter.logout(req, res, '/public');
      assert.strictEqual(res.redirectedTo, '/public');
      done();
    });
  });

  describe('redirectToUserAccountConsole()', function() {
    it('redirects to realm account console endpoint', function() {
      const adapter = buildAdapter({
        authServerUrl: 'https://kc.example.com',
        realmName: 'realm-a'
      });
      const res = {
        redirectedTo: null,
        redirect(url) {
          this.redirectedTo = url;
        }
      };

      adapter.redirectToUserAccountConsole(res);
      assert.strictEqual(res.redirectedTo, 'https://kc.example.com/realms/realm-a/account/');
    });
  });

  describe('scope helpers', function() {
    it('hasScope works with space-separated scope string', function() {
      const adapter = buildAdapter();
      const scopeString = 'openid profile email';

      assert.strictEqual(adapter.hasScope(scopeString, 'email'), true);
      assert.strictEqual(adapter.hasScope(scopeString, 'offline_access'), false);
    });

    it('hasScope works with scope array', function() {
      const adapter = buildAdapter();
      assert.strictEqual(adapter.hasScope(['openid', 'profile'], 'openid'), true);
      assert.strictEqual(adapter.hasScope(['openid', 'profile'], 'email'), false);
    });

    it('hasScopes supports all mode (default)', function() {
      const adapter = buildAdapter();
      const scopeString = 'openid profile email';

      assert.strictEqual(adapter.hasScopes(scopeString, ['openid', 'email']), true);
      assert.strictEqual(adapter.hasScopes(scopeString, ['openid', 'offline_access']), false);
    });

    it('hasScopes supports any mode', function() {
      const adapter = buildAdapter();
      const scopeString = 'openid profile';

      assert.strictEqual(adapter.hasScopes(scopeString, ['email', 'profile'], 'any'), true);
      assert.strictEqual(adapter.hasScopes(scopeString, ['email', 'offline_access'], 'any'), false);
    });

    it('getTokenClaims returns decoded claims when available', function() {
      const adapter = buildAdapter();
      const req = {
        kauth: {
          grant: {
            access_token: {
              content: {
                preferred_username: 'alice',
                scope: 'openid profile email'
              }
            }
          }
        }
      };

      const claims = adapter.getTokenClaims(req);
      assert.strictEqual(claims.preferred_username, 'alice');
      assert.strictEqual(claims.scope, 'openid profile email');
    });

    it('getTokenClaims returns empty object when missing', function() {
      const adapter = buildAdapter();
      assert.deepStrictEqual(adapter.getTokenClaims({}), {});
    });

    it('isAuthenticated returns true only when access token is present', function() {
      const adapter = buildAdapter();
      const yesReq = { kauth: { grant: { access_token: { content: {} } } } };
      const noReq = { kauth: { grant: {} } };

      assert.strictEqual(adapter.isAuthenticated(yesReq), true);
      assert.strictEqual(adapter.isAuthenticated(noReq), false);
    });

    it('getScopes supports req input', function() {
      const adapter = buildAdapter();
      const req = {
        kauth: {
          grant: {
            access_token: {
              content: {
                scope: 'openid profile email'
              }
            }
          }
        }
      };

      assert.deepStrictEqual(adapter.getScopes(req), ['openid', 'profile', 'email']);
    });

    it('hasScopeFromRequest works with request token scope', function() {
      const adapter = buildAdapter();
      const req = {
        kauth: {
          grant: {
            access_token: {
              content: {
                scope: 'openid profile'
              }
            }
          }
        }
      };

      assert.strictEqual(adapter.hasScopeFromRequest(req, 'profile'), true);
      assert.strictEqual(adapter.hasScopeFromRequest(req, 'email'), false);
    });

    it('hasScopesFromRequest supports all/any modes', function() {
      const adapter = buildAdapter();
      const req = {
        kauth: {
          grant: {
            access_token: {
              content: {
                scope: 'openid profile'
              }
            }
          }
        }
      };

      assert.strictEqual(adapter.hasScopesFromRequest(req, ['openid', 'profile'], 'all'), true);
      assert.strictEqual(adapter.hasScopesFromRequest(req, ['openid', 'email'], 'all'), false);
      assert.strictEqual(adapter.hasScopesFromRequest(req, ['email', 'profile'], 'any'), true);
    });

    it('requireScopes calls next when scope check passes', function(done) {
      const adapter = buildAdapter();
      const req = {
        kauth: {
          grant: {
            access_token: {
              content: {
                scope: 'openid profile email'
              }
            }
          }
        }
      };

      const mw = adapter.requireScopes(['openid', 'email'], 'all');
      mw(req, {}, () => done());
    });

    it('requireScopes returns 403 JSON payload when scope check fails', function() {
      const adapter = buildAdapter();
      const req = {
        kauth: {
          grant: {
            access_token: {
              content: {
                scope: 'openid'
              }
            }
          }
        }
      };

      let statusCode = null;
      let payload = null;
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        json(data) {
          payload = data;
        }
      };

      const mw = adapter.requireScopes(['openid', 'email'], 'all');
      mw(req, res, () => {});

      assert.strictEqual(statusCode, 403);
      assert.strictEqual(payload.error, 'forbidden');
      assert.strictEqual(payload.mode, 'all');
    });
  });

  describe('service-to-service helpers', function() {
    it('getServiceToken returns cached token when still valid', async function() {
      const adapter = buildAdapter();
      let calls = 0;

      adapter.loginWithCredentials = async () => {
        calls += 1;
        return {
          access_token: 'svc-token-1',
          token_type: 'Bearer',
          expires_in: 60,
          scope: 'openid'
        };
      };

      const first = await adapter.getServiceToken({ scope: 'openid' });
      const second = await adapter.getServiceToken({ scope: 'openid' });

      assert.strictEqual(first.accessToken, 'svc-token-1');
      assert.strictEqual(second.accessToken, 'svc-token-1');
      assert.strictEqual(first.source, 'fresh');
      assert.strictEqual(second.source, 'cache');
      assert.strictEqual(calls, 1, 'token endpoint should be called once due to cache');
    });

    it('getServiceToken deduplicates concurrent refresh calls (single-flight)', async function() {
      const adapter = buildAdapter();
      let calls = 0;

      adapter.loginWithCredentials = async () => {
        calls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return {
          access_token: 'svc-token-concurrent',
          token_type: 'Bearer',
          expires_in: 60
        };
      };

      const [a, b] = await Promise.all([
        adapter.getServiceToken({ scope: 'profile', forceRefresh: true }),
        adapter.getServiceToken({ scope: 'profile', forceRefresh: true })
      ]);

      assert.strictEqual(a.accessToken, 'svc-token-concurrent');
      assert.strictEqual(b.accessToken, 'svc-token-concurrent');
      assert.strictEqual(calls, 1, 'single-flight should collapse concurrent refreshes');
    });

    it('callProtectedApi uses service token and retries once on 401', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;

      let tokenCalls = 0;
      let fetchCalls = 0;
      adapter.getServiceToken = async ({ forceRefresh } = {}) => {
        tokenCalls += 1;
        return {
          accessToken: forceRefresh ? 'fresh-token' : 'cached-token',
          tokenType: 'Bearer',
          source: forceRefresh ? 'fresh' : 'cache'
        };
      };

      global.fetch = async (_url, options) => {
        fetchCalls += 1;

        if (fetchCalls === 1) {
          assert.strictEqual(options.headers.Authorization, 'Bearer cached-token');
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            headers: { forEach: () => {}, get: () => 'application/json' },
            text: async () => JSON.stringify({ error: 'invalid_token' })
          };
        }

        assert.strictEqual(options.headers.Authorization, 'Bearer fresh-token');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            forEach: (cb) => cb('application/json', 'content-type'),
            get: () => 'application/json'
          },
          text: async () => JSON.stringify({ result: 'ok' })
        };
      };

      try {
        const response = await adapter.callProtectedApi({
          url: 'https://api.example.com/resource',
          authMode: 'service'
        });

        assert.strictEqual(response.ok, true);
        assert.strictEqual(response.status, 200);
        assert.strictEqual(response.data.result, 'ok');
        assert.strictEqual(tokenCalls, 2, 'should force refresh token once after 401');
        assert.strictEqual(response.auth.retriedWithFreshToken, true);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi supports user mode', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;

      global.fetch = async (_url, options) => {
        assert.strictEqual(options.headers.Authorization, 'Bearer user-token-123');
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: {
            forEach: (cb) => cb('application/json', 'content-type'),
            get: () => 'application/json'
          },
          text: async () => JSON.stringify({ user: 'ok' })
        };
      };

      try {
        const response = await adapter.callProtectedApi({
          url: 'https://api.example.com/user',
          authMode: 'user',
          userToken: 'user-token-123'
        });

        assert.strictEqual(response.ok, true);
        assert.strictEqual(response.auth.mode, 'user');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

    // ── getServiceToken edge cases ──────────────────────────────────────────

    it('getServiceToken forces fresh fetch when token is within minValiditySeconds', async function() {
      const adapter = buildAdapter();
      let calls = 0;

      adapter.loginWithCredentials = async () => {
        calls += 1;
        return {
          access_token: `svc-token-${calls}`,
          token_type: 'Bearer',
          expires_in: 10,   // expires in 10 s
          scope: 'openid'
        };
      };

      // First fetch — stores token with ~10 s TTL
      await adapter.getServiceToken({ scope: 'openid' });

      // Request with minValiditySeconds=20 → cached token expires too soon → must refresh
      const result = await adapter.getServiceToken({ scope: 'openid', minValiditySeconds: 20 });

      assert.strictEqual(result.source, 'fresh');
      assert.strictEqual(calls, 2, 'should refetch when token expires within minValiditySeconds');
    });

    it('getServiceToken uses custom cacheKey independently from default key', async function() {
      const adapter = buildAdapter();
      let calls = 0;

      adapter.loginWithCredentials = async () => {
        calls += 1;
        return { access_token: `token-${calls}`, token_type: 'Bearer', expires_in: 300 };
      };

      const a = await adapter.getServiceToken({ scope: 'openid', cacheKey: 'my-key' });
      const b = await adapter.getServiceToken({ scope: 'openid', cacheKey: 'my-key' }); // same key → cache
      const c = await adapter.getServiceToken({ scope: 'openid' }); // default key → fresh

      assert.strictEqual(a.source, 'fresh');
      assert.strictEqual(b.source, 'cache');
      assert.strictEqual(c.source, 'fresh');
      assert.strictEqual(calls, 2);
    });

    it('getServiceToken joins scope array into space-separated string', async function() {
      const adapter = buildAdapter();
      let capturedScope;

      adapter.loginWithCredentials = async (creds) => {
        capturedScope = creds.scope;
        return { access_token: 'tok', token_type: 'Bearer', expires_in: 300, scope: creds.scope };
      };

      await adapter.getServiceToken({ scope: ['openid', 'profile', 'email'] });
      assert.strictEqual(capturedScope, 'openid profile email');
    });

    it('getServiceToken isolates cache entries per scope', async function() {
      const adapter = buildAdapter();
      let calls = 0;

      adapter.loginWithCredentials = async (creds) => {
        calls += 1;
        return { access_token: `tok-${creds.scope}`, token_type: 'Bearer', expires_in: 300, scope: creds.scope };
      };

      const a = await adapter.getServiceToken({ scope: 'openid' });
      const b = await adapter.getServiceToken({ scope: 'openid profile' });
      const c = await adapter.getServiceToken({ scope: 'openid' }); // cache hit

      assert.strictEqual(a.accessToken, 'tok-openid');
      assert.strictEqual(b.accessToken, 'tok-openid profile');
      assert.strictEqual(c.source, 'cache');
      assert.strictEqual(calls, 2);
    });

    it('getServiceToken throws when token endpoint returns no access_token', async function() {
      const adapter = buildAdapter();

      adapter.loginWithCredentials = async () => ({ token_type: 'Bearer', expires_in: 300 });

      await assert.rejects(
        () => adapter.getServiceToken({ scope: 'openid' }),
        /access_token/
      );
    });

    // ── callProtectedApi edge cases ─────────────────────────────────────────

    it('callProtectedApi throws when url is missing', async function() {
      const adapter = buildAdapter();

      await assert.rejects(
        () => adapter.callProtectedApi({ authMode: 'none' }),
        /url/i
      );
    });

    it('callProtectedApi passthrough mode preserves existing Authorization header', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;
      let capturedAuth;

      global.fetch = async (_url, options) => {
        capturedAuth = options.headers.Authorization;
        return {
          ok: true, status: 200, statusText: 'OK',
          headers: { forEach: () => {}, get: () => null },
          text: async () => ''
        };
      };

      try {
        await adapter.callProtectedApi({
          url: 'https://api.example.com/data',
          authMode: 'passthrough',
          headers: { Authorization: 'Bearer my-existing-token' }
        });
        assert.strictEqual(capturedAuth, 'Bearer my-existing-token');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi none mode sends no Authorization header', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;
      let capturedHeaders;

      global.fetch = async (_url, options) => {
        capturedHeaders = options.headers;
        return {
          ok: true, status: 200, statusText: 'OK',
          headers: { forEach: () => {}, get: () => null },
          text: async () => ''
        };
      };

      try {
        await adapter.callProtectedApi({ url: 'https://api.example.com/data', authMode: 'none' });
        assert.strictEqual(capturedHeaders.Authorization, undefined);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi throws when authMode=user without userToken', async function() {
      const adapter = buildAdapter();

      await assert.rejects(
        () => adapter.callProtectedApi({ url: 'https://api.example.com/data', authMode: 'user' }),
        /userToken/i
      );
    });

    it('callProtectedApi throws on unsupported authMode', async function() {
      const adapter = buildAdapter();

      await assert.rejects(
        () => adapter.callProtectedApi({ url: 'https://api.example.com/data', authMode: 'magic' }),
        /unsupported authMode/i
      );
    });

    it('callProtectedApi serializes json body and sets content-type', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;
      let capturedBody, capturedContentType;

      global.fetch = async (_url, options) => {
        capturedBody = options.body;
        capturedContentType = options.headers['content-type'];
        return {
          ok: true, status: 200, statusText: 'OK',
          headers: { forEach: () => {}, get: () => 'application/json' },
          text: async () => JSON.stringify({ ok: true })
        };
      };

      try {
        await adapter.callProtectedApi({
          url: 'https://api.example.com/data',
          method: 'POST',
          authMode: 'none',
          json: { foo: 'bar', num: 42 }
        });
        assert.strictEqual(capturedBody, JSON.stringify({ foo: 'bar', num: 42 }));
        assert.strictEqual(capturedContentType, 'application/json');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi skips retry when retryOnAuthError=false', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;
      let fetchCalls = 0;
      let getTokenCalls = 0;

      adapter.getServiceToken = async () => {
        getTokenCalls += 1;
        return { accessToken: 'tok', tokenType: 'Bearer', source: 'cache' };
      };

      global.fetch = async () => {
        fetchCalls += 1;
        return {
          ok: false, status: 401, statusText: 'Unauthorized',
          headers: { forEach: () => {}, get: () => null },
          text: async () => 'Unauthorized'
        };
      };

      try {
        const result = await adapter.callProtectedApi({
          url: 'https://api.example.com/data',
          authMode: 'service',
          retryOnAuthError: false
        });
        assert.strictEqual(result.status, 401);
        assert.strictEqual(fetchCalls, 1, 'should not retry');
        assert.strictEqual(result.auth.retriedWithFreshToken, false);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi aborts request on timeout', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;

      global.fetch = async (_url, options) => {
        return new Promise((_resolve, reject) => {
          if (options.signal) {
            options.signal.addEventListener('abort', () => {
              const err = new Error('The operation was aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }
          // Never resolve — waits for abort
        });
      };

      try {
        await assert.rejects(
          () => adapter.callProtectedApi({
            url: 'https://api.example.com/slow',
            authMode: 'none',
            timeoutMs: 30
          }),
          (err) => err.name === 'AbortError' || /aborted/i.test(err.message)
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi returns text data for non-JSON response', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;

      global.fetch = async () => ({
        ok: true, status: 200, statusText: 'OK',
        headers: { forEach: () => {}, get: () => 'text/plain' },
        text: async () => 'plain text response'
      });

      try {
        const result = await adapter.callProtectedApi({
          url: 'https://api.example.com/text',
          authMode: 'none'
        });
        assert.strictEqual(result.data, 'plain text response');
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi returns null data for empty body', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;

      global.fetch = async () => ({
        ok: true, status: 204, statusText: 'No Content',
        headers: { forEach: () => {}, get: () => null },
        text: async () => ''
      });

      try {
        const result = await adapter.callProtectedApi({
          url: 'https://api.example.com/delete',
          method: 'DELETE',
          authMode: 'none'
        });
        assert.strictEqual(result.status, 204);
        assert.strictEqual(result.data, null);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('callProtectedApi auth.retriedWithFreshToken is false on first-attempt success', async function() {
      const adapter = buildAdapter();
      const originalFetch = global.fetch;

      adapter.getServiceToken = async () => ({
        accessToken: 'tok', tokenType: 'Bearer', source: 'cache'
      });

      global.fetch = async () => ({
        ok: true, status: 200, statusText: 'OK',
        headers: { forEach: () => {}, get: () => 'application/json' },
        text: async () => JSON.stringify({ data: 1 })
      });

      try {
        const result = await adapter.callProtectedApi({
          url: 'https://api.example.com/data',
          authMode: 'service'
        });
        assert.strictEqual(result.auth.retriedWithFreshToken, false);
        assert.strictEqual(result.auth.mode, 'service');
      } finally {
        global.fetch = originalFetch;
      }
    });
});
