# Configuration and Initialization API

Constructor and module export behavior for keycloak-express-middleware.

## Namespace

- Class: `keycloakExpressMiddleware`
- Backward-compatible alias: `keycloackAdapter` (legacy typo)

## Constructor

### `new keycloakAdapter(app, keycloakConfig, keycloakOptions)`

Instantiate and initialize a Keycloak middleware instance bound to an Express app (or router context).

**Syntax:**
```javascript
const keycloak = new keycloakAdapter(app, keycloakConfig, keycloakOptions);
```

### Parameters

#### `app` (Express application) - Required

Express app instance used to register session handling and Keycloak middleware.

#### `keycloakConfig` (Object) - Required

Keycloak client config, typically from downloaded `keycloak.json`.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `realm` | string | Required | Keycloak realm name |
| `auth-server-url` | string | Required | Base URL of Keycloak server |
| `resource` | string | Required | Client ID |
| `credentials.secret` | string | Optional | Client secret (required for confidential clients) |
| `confidential-port` | number | Optional | Confidential port setting |

#### `keycloakOptions` (Object) - Required in practice

Advanced adapter options.

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `session` | Object | Recommended | Express-session settings |
| `session.secret` | string | Recommended | Session signing secret |
| `store` | Store | Auto-set | Overridden with in-memory store when `session` is enabled |
| `scope` | string | Optional | OIDC scopes |
| `idpHint` | string | Optional | Preferred identity provider |
| `cookies` | boolean | Optional | Cookie handling options |
| `realmUrl` | string | Optional | Realm URL override |
| `clientId` | string | Optional | Fallback for OIDC helpers |
| `clientSecret` | string | Optional | Fallback secret for OIDC helpers |

### Runtime Side Effects

On construction, the instance:

1. Initializes internal fields (`realmName`, `authServerUrl`, `clientId`, `clientSecret`).
2. Configures `express-session` with an in-memory store if `keycloakOptions.session` is provided.
3. Instantiates `keycloak-connect`.
4. Registers `app.use(this.keycloak.middleware())`.
5. Flushes any queued callbacks from deprecated readiness flow.

### Returns

Instance of `keycloakExpressMiddleware`.

### Example

```javascript
const express = require('express');
const keycloakAdapter = require('keycloak-express-middleware');

const app = express();

const keycloak = new keycloakAdapter(
  app,
  {
    realm: 'Realm-Project',
    'auth-server-url': 'https://your-keycloak:8443/',
    resource: 'client-app',
    credentials: { secret: 'super-secret' },
    'confidential-port': 0
  },
  {
    session: {
      secret: 'mySessionSecret',
      resave: false,
      saveUninitialized: false
    }
  }
);
```

## Deprecated API

### `underKeycloakProtection(callback)`

Deprecated helper that executes `callback` immediately when middleware is ready, otherwise queues it.

Use normal Express route declaration directly after instance creation.

## Module Exports

The package exposes:

- `module.exports = keycloakExpressMiddleware`
- `module.exports.keycloackAdapter = keycloakExpressMiddleware` (legacy alias)
- `module.exports.default = keycloakExpressMiddleware`

## Notes and Constraints

- Session storage defaults to `MemoryStore` when enabled in options. This is suitable for local/dev usage but not for production scale.
- Create one adapter instance per client configuration to support multi-client use cases in one Express app.
- OIDC token endpoint helper methods rely on `realmName`, `authServerUrl`, `clientId`, and optional `clientSecret` initialized here.
