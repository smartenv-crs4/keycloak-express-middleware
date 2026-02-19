# Integration Guide: Adding OIDC Methods to keycloak-express-middleware

This guide explains how to integrate the new OIDC authentication methods (`generateAuthorizationUrl()`, `login()`, `loginPKCE()`) into the `keycloak-express-middleware` class.

## Files Created

- **`oidc-methods.js`** - Ready-to-use OIDC methods (no external dependencies)
- **`test/oidc-methods.test.js`** - Complete test suite (run with `npm test`)

## Integration Steps

### Step 1: Run Tests (Verify Methods Work)

```bash
npm test
```

Expected output: All tests should pass (20+ assertions)

### Step 2: Locate the Constructor in index.js

Find the `keycloakExpressMiddleware` constructor:

```javascript
constructor(app, keyCloackConfig, keyCloackOptions) {
    this.keycloak = null;
    this.ready = false;
    this.readyQueue = [];
    this.realmName = keyCloackConfig.realm || keyCloackOptions.realmName;
    this.authServerUrl = keyCloackConfig['auth-server-url'];
    // ... rest of constructor
}
```

### Step 3: Save Configuration in Constructor

Add these lines after `this.authServerUrl`:

```javascript
// Store OIDC configuration for token endpoint helpers
this.clientId = keyCloackConfig.resource || keyCloackOptions.clientId;
this.clientSecret = keyCloackConfig.credentials?.secret || keyCloackOptions.clientSecret;
```

**Full example:**

```javascript
constructor(app, keyCloackConfig, keyCloackOptions) {
    this.keycloak = null;
    this.ready = false;
    this.readyQueue = [];
    this.realmName = keyCloackConfig.realm || keyCloackOptions.realmName;
    this.authServerUrl = keyCloackConfig['auth-server-url'];
    
    // NEW: Store OIDC configuration
    this.clientId = keyCloackConfig.resource || keyCloackOptions.clientId;
    this.clientSecret = keyCloackConfig.credentials?.secret || keyCloackOptions.clientSecret;
    
    // ... rest of constructor (unchanged)
}
```

### Step 4: Add Methods to the Class

At the end of the `keycloakExpressMiddleware` class (before the closing brace), add these three methods from `oidc-methods.js`:

```javascript
    // ===== OIDC Authentication Methods =====
    
    /**
     * Generate Authorization URL + PKCE pair for OAuth2 flow
     * See oidc-methods.js for full documentation
     */
    generateAuthorizationUrl(options = {}) {
        // ... copy from oidc-methods.js
    }

    /**
     * Exchange credentials for OIDC tokens (generic token endpoint)
     * See oidc-methods.js for full documentation
     */
    async login(credentials = {}) {
        // ... copy from oidc-methods.js
    }

    /**
     * Exchange authorization code + PKCE verifier for tokens
     * See oidc-methods.js for full documentation
     */
    async loginPKCE(credentials = {}) {
        // ... copy from oidc-methods.js
    }
```

**Option: Copy-Paste from oidc-methods.js**

You can copy the entire content from `oidc-methods.js` (lines with the three functions) directly into the class.

### Step 5: Run Tests Again

```bash
npm test
```

Verify that all tests pass with the new methods integrated.

### Step 6: Test in Your Application

Create a simple test to verify the middleware works:

```javascript
const keycloakAdapter = require('keycloak-express-middleware');
const express = require('express');

const app = express();

// Configure middleware
await keycloakAdapter.configure({
  app,
  keyCloakConfig: {
    realm: 'my-realm',
    'auth-server-url': 'https://keycloak.example.com/',
    resource: 'my-client',
    credentials: { secret: 'my-secret' }
  }
});

// Test PKCE flow initialization
const pkceFlow = keycloakAdapter.generateAuthorizationUrl({
  redirect_uri: 'http://localhost:3000/auth/callback'
});

console.log('Auth URL:', pkceFlow.authUrl);
console.log('State:', pkceFlow.state);
console.log('Code Verifier:', pkceFlow.codeVerifier);
```

## Key Points

### 1. No External Dependencies
- Uses only Node.js built-in `crypto` module
- Uses global `fetch` (available in Node 18+)
- No new npm packages needed

### 2. Backward Compatibility
- All existing middleware functionality remains unchanged
- New methods are optional additions
- No breaking changes to existing API

### 3. Configuration Sources
The three methods use these configuration values from the middleware:
- `this.authServerUrl` - From `keyCloakConfig['auth-server-url']`
- `this.realmName` - From `keyCloakConfig.realm`
- `this.clientId` - From `keyCloakConfig.resource` (or `keyCloackOptions.clientId`)
- `this.clientSecret` - From `keyCloakConfig.credentials.secret` (or `keyCloackOptions.clientSecret`)

### 4. Usage Examples

#### Generate Authorization URL (for PKCE login initiation)

```javascript
const pkceFlow = keycloakAdapter.generateAuthorizationUrl({
  redirect_uri: 'https://app.example.com/auth/callback',
  scope: 'openid profile email'  // optional
});

req.session.pkce_state = pkceFlow.state;
req.session.pkce_verifier = pkceFlow.codeVerifier;

res.redirect(pkceFlow.authUrl);
```

#### Exchange Code for Token (for PKCE callback)

```javascript
const tokens = await keycloakAdapter.loginPKCE({
  code: req.query.code,
  redirect_uri: 'https://app.example.com/auth/callback',
  code_verifier: req.session.pkce_verifier
});

res.cookie('access_token', tokens.access_token, { httpOnly: true });
res.redirect('/dashboard');
```

#### Direct Token Grant

```javascript
// Password grant
const tokens = await keycloakAdapter.login({
  grant_type: 'password',
  username: 'user@example.com',
  password: 'password123'
});

// Client credentials
const tokens = await keycloakAdapter.login({
  grant_type: 'client_credentials'
});

// Refresh token
const newTokens = await keycloakAdapter.login({
  grant_type: 'refresh_token',
  refresh_token: oldRefreshToken
});
```

## Verification Checklist

- [ ] All tests in `test/oidc-methods.test.js` pass
- [ ] Constructor saves `clientId` and `clientSecret`
- [ ] Three methods added to the class
- [ ] `generateAuthorizationUrl()` works
- [ ] `login()` works
- [ ] `loginPKCE()` works
- [ ] Existing middleware functionality still works
- [ ] No runtime errors

## Troubleshooting

### Error: "requires middleware to be initialized"
- Ensure `configure()` was called before using OIDC methods
- Verify `authServerUrl`, `realmName`, and `clientId` are set

### Error: "generateAuthorizationUrl requires redirect_uri"
- Pass `redirect_uri` or `redirectUri` in options object

### Fetch errors
- Ensure Node.js 18+ (for global fetch)
- For Node 16-17, add: `npm install node-fetch`

## Testing Checklist

Run tests to verify:

```bash
# All tests pass
npm test

# Test output shows:
# - 20+ assertions passing
# - No failures
# - OIDC Methods suite: ✓
```

## Questions?

Refer to:
- `oidc-methods.js` - Method implementations and full JSDoc documentation
- `test/oidc-methods.test.js` - Test examples showing all use cases
- [PKCE Login Flow Guide](../keycloak-api-manager/docs/guides/PKCE-Login-Flow.md) - Real-world usage patterns
