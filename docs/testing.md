# Testing Guide

The test suite for keycloak-express-middleware validates OIDC implementation against a real Keycloak server.

## Test Architecture

### Design Philosophy

- **Unit Tests First**: Test OIDC methods work without live Keycloak (mocked adapters)
- **Integration Ready**: When Keycloak is available, validate against real server
- **Graceful Degradation**: Tests continue even if Keycloak unavailable (with warnings)
- **Automatic Setup**: Realm and client auto-created on first test run

### Test Layers

```
test/
├── support/
│   ├── setup.js                    # Global Mocha hooks, initialization
│   └── enableServerFeatures.js     # Realm/client creation, Keycloak admin client
├── helpers/
│   └── config.js                   # PropertiesManager configuration loader
├── docker-keycloak/
│   ├── setup-keycloak.js           # Interactive deployment script
│   ├── docker-compose.yml          # Local HTTP deployment
│   ├── docker-compose-https.yml    # Local HTTPS deployment
│   └── certs/                      # SSL certificate folder
├── oidc-methods.test.js            # Unit tests for OIDC methods
└── .mocharc.json                   # Mocha configuration
```

## Running Tests

### Full Test Suite

```bash
# From project root
npm test

# What happens:
# 1. Installs test dependencies: npm --prefix test install
# 2. Runs Mocha with NODE_ENV=test: NODE_ENV=test mocha --require support/setup.js --exit
# 3. Global setup runs before tests
# 4. Attempts to initialize Keycloak realm/client (if available)
# 5. Runs all *.test.js files
# 6. Cleans up after tests
```

### Running Specific Tests

```bash
# From test/ directory
cd test

# Run only specific test file
npm test -- oidc-methods.test.js

# Run tests matching pattern
npm test -- --grep "generateAuthorizationUrl"

# Run with increased timeout (for slow servers)
npm test -- --timeout 60000
```

### Running Without Global Setup

Useful for debugging:

```bash
cd test

# Skip global setup, run raw Mocha
npx mocha oidc-methods.test.js
```

## Initialization Flow (test/support/setup.js)

Before any tests run:

1. **Load Configuration**
   - PropertiesManager loads `test/config/default.json`
   - NODE_ENV=test selects "test" block
   - Keycloak baseUrl determined from config

2. **Attempt Server Feature Setup**
   ```javascript
   try {
     await enableServerFeatures()
   } catch (error) {
     console.warn('Keycloak unavailable:', error.message)
     global.testContext.keycloakAvailable = false
   }
   ```

3. **Set Global Test Context** (always set, even if Keycloak fails)
   ```javascript
   global.testContext = {
     adminClient: null,        // Keycloak admin client (if available)
     realm: null,              // Test realm object
     keycloakAvailable: false  // Flag for conditional tests
   }
   ```

## Realm and Client Initialization (test/support/enableServerFeatures.js)

When Keycloak is reachable and credentials valid:

1. **Create Keycloak Admin Client**
   ```javascript
   const adminClient = new KeycloakAdminClient({
     baseUrl: keycloakConfig.baseUrl,
     realmName: 'master',
     credentials: {
       username: keycloakConfig.username,
       password: keycloakConfig.password,
       clientId: keycloakConfig.clientId,
       grantType: keycloakConfig.grantType
     }
   })
   ```

2. **Handle Self-Signed Certificates** (for HTTPS testing)
   ```javascript
   NODE_TLS_REJECT_UNAUTHORIZED = '0'  // Trust self-signed certs (testing only)
   ```

3. **Create or Reuse Test Realm**
   - Realm name: `express-middleware-test`
   - Idempotent: If exists, reuses it
   - Sets: displayName, enabled, etc.

4. **Create or Reuse Test Client**
   - Client ID: `express-middleware-test-client`
   - Sets client type, scopes, protocol mappers
   - Enables OIDC flows being tested

5. **Store in Global Context**
   ```javascript
   global.testContext = {
     adminClient,
     realm,
     keycloakAvailable: true
   }
   ```

## Test Execution

### Example: Unit Test (No Keycloak Needed)

```javascript
// test/oidc-methods.test.js
describe('OIDC Methods', () => {
  it('should generate authorization URL with PKCE', () => {
    const url = generateAuthorizationUrl({
      baseUrl: 'https://keycloak.example.com:8443',
      clientId: 'test-client',
      redirectUri: 'https://app.example.com/callback'
    })

    expect(url).to.include('client_id=test-client')
    expect(url).to.include('code_challenge')
    expect(url).to.include('code_challenge_method=S256')
  })
})
```

**Why it works without Keycloak**: Tests mock the adapters or test pure logic

### Example: Integration Test (Keycloak Needed)

```javascript
// Conditional test - only runs if Keycloak available
if (global.testContext.keycloakAvailable) {
  describe('Integration with Live Keycloak', () => {
    it('should exchange auth code for token', async function() {
      this.timeout(10000)

      const token = await loginWithCredientials({
        baseUrl: global.testContext.realm.baseUrl,
        clientId: global.testContext.realm.clientId,
        username: 'test-user',
        password: 'test-password'
      })

      expect(token).to.have.property('access_token')
      expect(token).to.have.property('token_type', 'Bearer')
    })
  })
}
```

## Mocha Configuration (test/.mocharc.json)

```json
{
  "spec": ["**/*.test.js"],
  "timeout": 30000,
  "slow": 10000,
  "exit": true,
  "reporter": "spec"
}
```

**Explanation**:
- `spec`: Find all `*.test.js` files recursively
- `timeout`: 30-second timeout per test (accounts for Keycloak initialization)
- `slow`: Mark test as slow if > 10 seconds
- `exit`: Process exits after tests complete (important for CI/CD)
- `reporter`: Use standard Mocha spec reporter (shows test names and results)

## Writing New Tests

### 1. Create Test File

```bash
touch test/my-feature.test.js
```

### 2. Use PropertiesManager Configuration

```javascript
const { getKeycloakConfig } = require('./helpers/config')

describe('My Feature', () => {
  const config = getKeycloakConfig()

  it('should work with Keycloak', async () => {
    // Use config.baseUrl, config.clientId, etc.
  })
})
```

### 3. Conditional Integration Tests

```javascript
if (global.testContext.keycloakAvailable) {
  describe('Integration Tests', () => {
    beforeEach(async () => {
      // Use global.testContext.adminClient for setup
      adminClient = global.testContext.adminClient
    })

    it('should authenticate against real Keycloak', async () => {
      // Integration test using live Keycloak
    })
  })
}
```

### 4. Cleanup

Always clean up created resources:

```javascript
afterEach(async () => {
  if (global.testContext.keycloakAvailable) {
    // Delete test user, client, etc.
    await adminClient.users.del({ id: userId })
  }
})
```

### 5. Best Practices

- ✓ Use unique names for resources (timestamps, UUIDs)
- ✓ Avoid destructive realm-wide operations
- ✓ Clean up in `afterEach` hooks
- ✓ Skip integration tests if `keycloakAvailable === false`
- ✓ Use descriptive test names
- ✓ Include comments for non-obvious logic

## Handling Keycloak Unavailability

Tests are designed to work even without Keycloak:

### Scenario 1: Unit Tests (No Keycloak needed)

```bash
npm test

# Output:
# ✓ generateAuthorizationUrl tests pass (mocked/local logic)
# ⊘ Integration tests skipped (Keycloak unavailable)
```

### Scenario 2: Keycloak Available

```bash
npm run setup-keycloak  # Start or configure Keycloak
npm test

# Output:
# ✓ All unit tests pass
# ✓ All integration tests pass
```

## Debugging Failed Tests

### Enable Verbose Output

```bash
cd test
DEBUG=* npm test  # Show all debug output
```

### Check Keycloak Connection

```bash
# From test root
cd test

# Verify configuration is correct
node -e "console.log(require('./helpers/config').getKeycloakConfig())"

# Test direct connection
node -e "
  const config = require('./helpers/config').getKeycloakConfig()
  fetch(config.baseUrl + '/health')
    .then(r => r.json())
    .then(d => console.log('✓ Keycloak reachable:', d))
    .catch(e => console.error('✗ Connection failed:', e.message))
"
```

### Inspect Test Realm

```bash
# After tests run, verify realm was created
curl http://localhost:8080/admin/realms/express-middleware-test \
  -H "Authorization: Bearer $TOKEN"

# Get admin token first
TOKEN=$(curl -X POST http://localhost:8080/realms/master/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&client_id=admin-cli&grant_type=password" \
  | jq -r '.access_token')
```

## Continuous Integration

### GitHub Actions Example

```yaml
- name: Start Keycloak
  run: npm run setup-keycloak  # Interactive script - need to handle this in CI

- name: Run Tests
  env:
    NODE_ENV: test
  run: npm test
```

For CI/CD, consider:
- Non-interactive setup-keycloak variant
- Pre-configured, reusable Keycloak container
- Timeout handling for slow CI environments

## Test Performance

Typical test execution:
- **Unit tests only**: ~2 seconds
- **With Keycloak setup**: ~15-30 seconds (first run)
- **Subsequent runs**: ~5-10 seconds (realm reused)

Optimize by:
- Running unit tests during development
- Running full suite before commits/pushes
- Reusing test realm instead of recreating it

## Troubleshooting

### Tests timeout

```bash
# Increase timeout
npm --prefix test test -- --timeout 60000
```

### "Cannot find module" errors

```bash
# Install test dependencies
cd test
npm install
```

### Keycloak admin client errors

- Verify credentials in `test/config/default.json`
- Ensure Keycloak is running: `docker ps | grep keycloak`
- Check network connectivity to Keycloak baseUrl

### "ECONNREFUSED" errors

- Keycloak not running or not reachable
- Check port: `lsof -i :8080` or `lsof -i :8443`
- Verify baseUrl in config is correct and reachable

### Tests pass locally but fail in CI

- Config differences between environments
- Missing secrets in CI environment
- Network/firewall restrictions in CI
- Keycloak version differences

## Next Steps

1. **For developers**: Run `npm test` locally, use unit tests for quick feedback
2. **For CI/CD**: Set up non-interactive Keycloak deployment
3. **For new features**: Add integration tests that validate against real Keycloak
4. **For production**: Ensure HTTPS with valid certificates (not self-signed)
