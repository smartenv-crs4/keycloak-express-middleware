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
  });
});
