# Documentation

Complete documentation for keycloak-express-middleware testing infrastructure.

> ⚠️ **Attenzione:** Il file `test/config/secrets.json` contiene tutte le password e i segreti sensibili. NON va mai committato! Usa `secrets.json.example` come template e personalizza solo in locale.

## Quick Start

1. **First time setup**: [Deployment Guide](deployment.md)
   ```bash
   npm run setup-keycloak
   npm test
   ```

2. **Understanding the test structure**: [Testing Guide](testing.md)

3. **Configuration details**: [Test Configuration](test-configuration.md)

## Documentation Index

### Core Documentation

- **[Deployment Guide](deployment.md)**
  - Local HTTP/HTTPS setup (docker-compose)
  - Remote SSH deployment
  - Verification and troubleshooting
  - Operational tips and port management

- **[Keycloak Setup](keycloak-setup.md)**
  - Keycloak version requirements
  - Feature flags and Docker deployment
  - Server readiness verification
  - OIDC compliance information

- **[Test Configuration](test-configuration.md)**
  - PropertiesManager layering (default.json, secrets.json, local.json)
  - Required configuration keys
  - Environment-based setup
  - Security rules and best practices

- **[Testing Guide](testing.md)**
  - Test architecture and layers
  - Running tests locally and in CI/CD
  - Global initialization flow
  - Writing new tests
  - Debugging test failures

- **[Architecture](architecture.md)**
  - Package structure and modules
  - Core OIDC methods
  - Middleware pattern
  - Runtime initialization sequence
  - Design principles and resilience

## Common Tasks

### Setup Keycloak for Testing

```bash
# Interactive setup (guided)
npm run setup-keycloak

# Or manually:
cd test/docker-keycloak
docker-compose up -d          # For HTTP (localhost:8080)
# OR
docker-compose -f docker-compose-https.yml up -d  # For HTTPS (localhost:8443)
```

### Run Tests

```bash
# Full suite
npm test

# Specific file
npm --prefix test test oidc-methods.test.js

# Matching pattern
npm --prefix test test -- --grep "PKCE"
```

### Update Keycloak URL

```bash
# Automatic update with verification
npm run setup-keycloak

# Manual: Edit test/config/default.json
# → Update test.keycloak.baseUrl
```

### Add SSL Certificates

See [certs/README.md](../test/docker-keycloak/certs/README.md) for:
- Self-signed certificate generation
- Let's Encrypt integration
- Certificate validation and security

## File Structure

```
docs/
├── README.md                    # This file (documentation index)
├── deployment.md                # Setup and deployment guide
├── keycloak-setup.md            # Keycloak server requirements
├── test-configuration.md        # Configuration management
├── testing.md                   # Test execution and writing
└── architecture.md              # System design and modules
```

## Configuration Hierarchy

```
test/config/
├── default.json (committed)
│   └─ Production and test default settings
├── secrets.json.example (committed)
│   └─ Template for secrets.json (edit and copy locally)
├── secrets.json (git-ignored, locale!)
│   └─ Passwords, API keys, testPassword, adminPassword, clientSecret
└── local.json (git-ignored)
    └─ Developer machine overrides (optional)
```

Quando `NODE_ENV=test`, viene caricato solo il blocco "test" di questi file.

## Test Infrastructure

```
test/
├── support/
│   ├── setup.js                 # Global Mocha hooks
│   └── enableServerFeatures.js  # Realm/client creation
├── helpers/
│   └── config.js                # Config loader
├── docker-keycloak/
│   ├── setup-keycloak.js        # Interactive setup command
│   ├── docker-compose.yml       # HTTP deployment
│   ├── docker-compose-https.yml # HTTPS deployment
│   └── certs/                   # SSL certificates folder
├── oidc-methods.test.js         # Unit and integration tests
└── .mocharc.json                # Mocha configuration
```

## Key Concepts

### PropertiesManager Configuration

Configuration is environment-aware:
```javascript
// When NODE_ENV=test:
const pm = require('propertiesmanager').conf
pm.keycloak.baseUrl  // From "test" block in config files
```

### Graceful Degradation

Tests work even without Keycloak:
- ✓ Unit tests always run (mocked/local logic)
- ⊘ Integration tests skip gracefully (if Keycloak unavailable)
- ⚠️ Warning shown but process continues

### Self-Signed Certificate Support

For HTTPS testing:
```javascript
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'  // Trusted during tests only
```

### Global Test Context

Available in all test files:
```javascript
global.testContext = {
  adminClient: <KeycloakAdminClient|null>,
  realm: <RealmObject|null>,
  keycloakAvailable: <boolean>
}
```

## Troubleshooting

### Connection Issues
- Verify Keycloak running: `docker ps | grep keycloak`
- Check baseUrl in `test/config/default.json`
- Verify network: `curl -v $(cat test/config/default.json | jq -r .test.keycloak.baseUrl)/health`

### Configuration Problems
- Check JSON syntax: `jq < test/config/default.json`
- Verify NODE_ENV: `echo $NODE_ENV` (should be "test" during tests)
- Check file priority: Later files override earlier ones

### Test Failures
- Run specific test: `npm --prefix test test -- --grep "test-name"`
- Increase timeout: `npm --prefix test test -- --timeout 60000`
- Check Keycloak logs: `docker logs keycloak`

### Certificate Errors
- Verify certificates exist: `ls -la test/docker-keycloak/certs/`
- Check permissions: `chmod 644 certs/keycloak.crt && chmod 600 certs/keycloak.key`
- Regenerate if needed: See [certs/README.md](../test/docker-keycloak/certs/README.md)

## Security Considerations

- ✅ Commit: `default.json` (non-sensitive), `.gitignore` rules, certificates structure
- ❌ Don't commit: Passwords, secrets.json, local.json, actual certificate files
- ⚠️ Testing only: `NODE_TLS_REJECT_UNAUTHORIZED=0` for self-signed certificates
- 🔐 Production: Always use valid certificates and strong authentication

## Related Files

- [Root README](../README.md) - Package overview
- [Root package.json](../package.json) - Scripts and dependencies
- [test/package.json](../test/package.json) - Test-specific dependencies
- [test/config/default.json](../test/config/default.json) - Active configuration
- [test/docker-keycloak/certs/README.md](../test/docker-keycloak/certs/README.md) - Certificate setup

## Getting Help

1. Check relevant documentation section above
2. Review test/support/setup.js for initialization details
3. Run test with verbose output: `DEBUG=* npm test`
4. Check Keycloak logs: `docker logs keycloak`
5. Verify configuration: `node -e "console.log(require('./test/helpers/config').getKeycloakConfig())"`

## Next Steps

- **New developer**: Start with [Testing Guide](testing.md)
- **Deploying Keycloak**: See [Deployment Guide](deployment.md)
- **Understanding configuration**: Read [Test Configuration](test-configuration.md)
- **System architect**: Study [Architecture](architecture.md)
- **Setting up HTTPS**: Check [certs/README.md](../test/docker-keycloak/certs/README.md)
