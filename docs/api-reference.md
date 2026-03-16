# API Reference

Complete API documentation for keycloak-express-middleware.

## Table of Contents

### Core API
- [Configuration and Initialization](api/configuration.md) - Constructor behavior, session wiring, exports

### Route Protection API
- [Route Protection](api/route-protection.md) - protectMiddleware and customProtectMiddleware
- [Authorization Services](api/authorization-services.md) - enforcerMiddleware and customEnforcerMiddleware

### Token Helpers API
- [Token Decode Helpers](api/token-decode-helpers.md) - encodeTokenRole and encodeTokenPermission
- [OIDC Token Endpoint Helpers](api/oidc-token-endpoint.md) - generateAuthorizationUrl, loginWithCredentials, loginPKCE

### Session and Navigation API
- [Session and Navigation](api/session-and-navigation.md) - login, loginMiddleware, logout, logoutMiddleware, redirectToUserAccountConsole

## Quick Reference

### Initialization

```javascript
const express = require('express');
const keycloakAdapter = require('keycloak-express-middleware');

const app = express();

const keycloak = new keycloakAdapter(
  app,
  {
    realm: 'my-realm',
    'auth-server-url': 'https://keycloak.example.com/',
    resource: 'my-client',
    credentials: { secret: 'my-client-secret' },
    'confidential-port': 0
  },
  {
    session: {
      secret: 'change-me'
    }
  }
);
```

### Main Public Methods

| Method | Type | Purpose |
|--------|------|---------|
| `protectMiddleware(conditions?)` | Middleware factory | Protect route by authentication/roles |
| `customProtectMiddleware(fn)` | Middleware factory | Dynamic role string from request |
| `enforcerMiddleware(conditions, options?)` | Middleware factory | Keycloak Authorization Services permission checks |
| `customEnforcerMiddleware(fn, options?)` | Middleware factory | Dynamic permission string from request |
| `encodeTokenRole()` | Middleware factory | Attach decoded role-aware token helper |
| `encodeTokenPermission()` | Middleware factory | Attach permission-check helper |
| `loginMiddleware(redirectTo)` | Middleware factory | Force login then redirect |
| `logoutMiddleware(redirectTo)` | Middleware factory | Force logout then redirect |
| `login(req, res, redirectTo)` | Function | Force login in route handler |
| `logout(req, res, redirectTo)` | Function | Force logout in route handler |
| `generateAuthorizationUrl(options)` | Function | Start PKCE flow |
| `loginWithCredentials(credentials)` | Async function | Generic token endpoint call |
| `loginPKCE(credentials)` | Async function | PKCE authorization code exchange |
| `redirectToUserAccountConsole(res)` | Function | Redirect to Keycloak account console |

## Parameter Conventions

- Required parameters are marked as `Required` in method sections.
- Optional parameters are marked as `Optional`.
- Middleware factories return Express middleware functions.
- Async OIDC helpers return Promises and should be awaited.

## Error Handling

Synchronous methods throw errors immediately on invalid input/state.
Async methods reject with `Error` when Keycloak responds with an error.

```javascript
try {
  const tokens = await keycloak.loginPKCE({
    code: req.query.code,
    redirect_uri: 'https://app.example.com/callback',
    code_verifier: req.session.codeVerifier
  });
  console.log(tokens.access_token);
} catch (error) {
  console.error('Authentication failed:', error.message);
}
```

## Compatibility Notes

- Package version target: `6.x`
- Runtime: Node.js with global `fetch` support (Node 18+ recommended)
- Backward-compatibility alias is preserved: `keycloackAdapter` (legacy typo)
