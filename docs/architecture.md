# Architecture and Runtime

This package provides middleware and utility functions for Express applications to integrate with Keycloak via OIDC.

## Package Structure

```
keycloak-express-middleware/
├── index.js                      # Main middleware export
├── oidc-methods.js               # Core OIDC utility functions
├── config.js                     # Configuration loader
├── test/                         # Test suite
│   ├── support/
│   │   ├── setup.js             # Mocha global hooks
│   │   └── enableServerFeatures.js
│   ├── helpers/
│   │   └── config.js             # Test config loader
│   ├── docker-keycloak/
│   │   ├── setup-keycloak.js    # Interactive setup script
│   │   ├── docker-compose.yml
│   │   └── certs/
│   ├── oidc-methods.test.js
│   └── .mocharc.json
└── docs/                         # This documentation
```

## Core OIDC Methods (oidc-methods.js)

The package exports utility functions for OIDC flows:

### generateAuthorizationUrl()

Generate an OAuth2 Authorization URL with PKCE.

```javascript
const { generateAuthorizationUrl } = require('keycloak-express-middleware')

const { url, codeVerifier } = generateAuthorizationUrl({
  baseUrl: 'https://keycloak.example.com:8443',
  clientId: 'my-app',
  redirectUri: 'https://app.example.com/callback',
  scope: 'openid profile email',
  state: 'random-state-value'
})

// url: Authorization endpoint with code_challenge
// codeVerifier: Store this client-side for token exchange
```

### loginWithCredentials()

Direct username/password flow (Resource Owner Password Credentials).

```javascript
const token = await loginWithCredentials({
  baseUrl: 'https://keycloak.example.com:8443',
  clientId: 'my-app',
  username: 'user@example.com',
  password: 'password',
  scope: 'openid profile'
})

// Returns: { access_token, token_type, refresh_token, expires_in, ... }
```

### loginPKCE()

Authorization Code + PKCE token exchange.

```javascript
const token = await loginPKCE({
  baseUrl: 'https://keycloak.example.com:8443',
  clientId: 'my-app',
  code: 'auth-code-from-callback',
  codeVerifier: 'stored-verifier-from-authorization-step',
  redirectUri: 'https://app.example.com/callback'
})

// Returns: { access_token, token_type, refresh_token, expires_in, ... }
```

## Middleware Pattern (index.js)

The middleware exports an Express middleware factory:

```javascript
const keycloakMiddleware = require('keycloak-express-middleware')

app.use(keycloakMiddleware({
  baseUrl: 'https://keycloak.example.com:8443',
  clientId: 'my-app',
  // Additional options...
}))
```

## Test Architecture

### Global Setup Flow (test/support/setup.js)

Before tests run:

```
1. Load Configuration (propertiesmanager)
   └─> NODE_ENV=test selects "test" block from config files
   
2. Attempt enableServerFeatures()
   └─> Create admin client
   └─> Create test realm if needed
   └─> Create test client if needed
   └─> Handle errors gracefully (continue if Keycloak unavailable)
   
3. Set Global Test Context
   └─> global.testContext.adminClient (or null if failed)
   └─> global.testContext.realm (or null if failed)
   └─> global.testContext.keycloakAvailable (boolean)
```

### Configuration Hierarchy (test/config/)

```
test/config/
├── default.json          ✓ Committed (production/test blocks)
├── secrets.json          ✗ Git-ignored (passwords)
└── local.json            ✗ Git-ignored (dev overrides)
```

PropertiesManager merges these files, with later files overriding earlier ones.

**Key Feature**: When NODE_ENV=test, only the "test" block is accessible:

```javascript
const pm = require('propertiesmanager').conf
console.log(pm.keycloak.baseUrl)  // ✓ From test block
// NOT pm.test.keycloak.baseUrl (structure is flattened)
```

### Keycloak Initialization (test/support/enableServerFeatures.js)

When live Keycloak is available:

```javascript
1. Create KeycloakAdminClient
   └─> Connect to Keycloak using master realm credentials
   └─> Authenticate as admin user
   
2. Create/Reuse Test Realm
   └─> Realm: "express-middleware-test"
   └─> Idempotent: Reuse if exists, create if not
   
3. Create/Reuse Test Client
   └─> Client ID: "express-middleware-test-client"
   └─> Configure OIDC settings and scopes
   └─> Return client details to test context
   
4. Handle Self-Signed Certificates
   └─> Set NODE_TLS_REJECT_UNAUTHORIZED=0 for HTTPS testing
   └─> Warning: Only for testing, never for production
```

### Test Execution (Mocha)

```bash
npm test
  ├─> npm --prefix test install    # Install test dependencies
  └─> NODE_ENV=test mocha          # Run tests with environment set
      ├─> Mocha loads setup.js (rootHooks)
      ├─> Global beforeAll runs
      │   ├─> enableServerFeatures() attempts
      │   └─> global.testContext is set
      ├─> All test files run (*.test.js)
      ├─> Global afterAll runs
      └─> Exit process
```

### Test File Structure

```javascript
// test/oidc-methods.test.js

const { expect } = require('chai')
const { generateAuthorizationUrl } = require('../oidc-methods')

describe('OIDC Methods', () => {
  // Unit tests (no Keycloak needed)
  describe('generateAuthorizationUrl', () => {
    it('should generate valid URL with PKCE', () => {
      // Test logic...
    })
  })

  // Integration tests (Keycloak needed)
  if (global.testContext.keycloakAvailable) {
    describe('Integration', () => {
      it('should exchange auth code', async () => {
        // Test logic using global.testContext...
      })
    })
  }
})
```

## Deployment Setup (test/docker-keycloak/)

### setup-keycloak.js - Interactive Deployment

This script guides users through Keycloak deployment:

```
npm run setup-keycloak
  ├─> Detect docker-compose availability
  ├─> Ask: Local or Remote deployment?
  │   ├─> LOCAL:
  │   │   ├─> Ask: HTTP or HTTPS?
  │   │   │   ├─> HTTP: Use docker-compose.yml
  │   │   │   └─> HTTPS: Validate certs, use docker-compose-https.yml
  │   │   └─> Start container, verify health
  │   │
  │   └─> REMOTE:
  │       ├─> Ask: SSH host and credentials
  │       ├─> Copy docker-compose files to remote
  │       ├─> Start container remotely
  │       └─> Verify endpoint reachable
  │
  └─> Update test/config/default.json with correct baseUrl
```

### Docker Configurations

**docker-compose.yml (HTTP)**:
- Keycloak on `localhost:8080`
- No certificate requirements
- Fast start for development

**docker-compose-https.yml (HTTPS)**:
- Keycloak on `localhost:8443`
- Mounts certificates from `certs/` folder
- Production-like testing

### Certificates (test/docker-keycloak/certs/)

```
certs/
├── .gitkeep           # Maintains folder in git
├── .gitignore         # Excludes *.crt, *.key from git
├── README.md          # Instructions for users
├── keycloak.crt       # (Not in repo - user provides)
└── keycloak.key       # (Not in repo - user provides)
```

**Security Model**:
- Folder kept in repository (.gitkeep)
- Certificates NOT committed (.gitignore rules)
- Users add their own certificates locally
- setup-keycloak.js validates certificates before HTTPS deployment

## Error Handling and Resilience

### Graceful Degradation

If Keycloak is unavailable:

```javascript
// setup.js catches errors from enableServerFeatures()
try {
  await enableServerFeatures()
} catch (error) {
  console.warn('⚠️  Keycloak unavailable:', error.message)
  global.testContext.keycloakAvailable = false
  // Execution continues - unit tests still run
}
```

### Why This Matters

- Developers can write/test code without live Keycloak (unit tests)
- CI/CD can run unit tests without Keycloak setup
- Integration tests run when Keycloak is available
- No hard failures due to infrastructure

### Self-Signed Certificate Handling

For HTTPS testing with self-signed certs:

```javascript
// enableServerFeatures.js
if (keycloakConfig.baseUrl.startsWith('https://')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}
```

**Important**: This is testing-only. Production Node.js applications should use valid certificates.

## Runtime Initialization Sequence

When running tests:

```
1. npm test invoked
   └─> Root package.json: "test" script runs

2. Installs test dependencies
   └─> npm --prefix test install
   └─> Downloads propertiesmanager, mocha, chai, etc.

3. Runs Mocha with NODE_ENV=test
   └─> Sets NODE_ENV=test environment variable
   └─> Requires test support/setup.js via --require flag

4. setup.js executes (global Mocha rootHooks.beforeAll)
   └─> propertiesmanager loads with NODE_ENV=test
   └─> Selects config from "test" block
   └─> Attempts enableServerFeatures()
   └─> Sets global.testContext

5. All test files found and executed
   └─> **/*.test.js matched by .mocharc.json
   └─> Tests check global.testContext.keycloakAvailable for conditionals
   └─> Unit tests run regardless
   └─> Integration tests run only if Keycloak available

6. Global afterAll runs (cleanup)
   └─> If implemented, removes test realm (optional)

7. Process exits
   └─> Mocha "exit": true in .mocharc.json
   └─> Ensures clean termination
```

## Configuration Flexibility

The system supports multiple deployment scenarios:

```
┌─────────────────┬──────────────┬──────────────┐
│ Scenario        │ Config       │ Certificates │
├─────────────────┼──────────────┼──────────────┤
│ Local Dev       │ default.json │ None needed  │
│ Local HTTPS     │ default.json │ Self-signed  │
│ Remote Dev      │ secrets.json │ None needed  │
│ Remote HTTPS    │ secrets.json │ Let's Encrypt│
│ CI/CD Pipeline  │ Env vars     │ From vault   │
└─────────────────┴──────────────┴──────────────┘
```

Each scenario:
- Uses propertiesmanager config layering
- Gracefully handles unavailable Keycloak
- Supports HTTPS with certificates
- Follows security best practices

## Key Design Principles

1. **Separation of Concerns**
   - oidc-methods.js: OIDC logic (framework-agnostic)
   - index.js: Express middleware
   - test/: Comprehensive test infrastructure

2. **Configuration as Data**
   - propertiesmanager for config management
   - Environment-based layering (dev/test/prod)
   - Secrets kept separate from code

3. **Resilient Testing**
   - Unit tests work without Keycloak
   - Integration tests optional (skipped if unavailable)
   - Graceful error handling

4. **Docker-First Deployment**
   - docker-compose for local testing
   - SSH support for remote deployment
   - Interactive setup for user guidance

5. **Security-Conscious**
   - Certificates in repo structure but not in lockfiles
   - Passwords in secrets.json (git-ignored)
   - Self-signed cert warnings during testing
   - NODE_TLS_REJECT_UNAUTHORIZED only for testing

## Module Dependencies

### Production
- None (OIDC methods use native Node.js APIs)

### Testing
- `mocha`: Test framework
- `chai`: Assertion library
- `propertiesmanager`: Configuration management
- `@keycloak/keycloak-admin-client`: Keycloak realm initialization

See [package.json](../test/package.json) for current versions.
