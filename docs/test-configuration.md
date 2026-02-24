# Test Configuration

> ⚠️ **Attenzione:** Il file `test/config/secrets.json` contiene tutte le password e i segreti sensibili (adminPassword, testPassword, clientSecret, ecc). NON va mai committato! Usa `secrets.json.example` come template e personalizza solo in locale.

Test configuration for keycloak-express-middleware is managed through `propertiesmanager` with environment-based layering.

## Architecture

Configuration uses a singleton pattern via `propertiesmanager` package. The active configuration section is selected based on `NODE_ENV` environment variable:

```
NODE_ENV=test → Loads "test" block from config files
NODE_ENV=production → Loads "production" block
```

The test runner automatically sets `NODE_ENV=test` before initialization.

## Configuration Files and Priority

Files are loaded in order of specificity. Later files override earlier ones:

1. **test/config/default.json** ✅ Committed to version control
   - Default configuration for all environments
   - Non-sensitive values only
   - Always up-to-date reference

2. **test/config/secrets.json.example** ✅ Committed (template only)
   - Template for secrets.json
   - Edit and copy as secrets.json locally

3. **test/config/secrets.json** ⚠️ Git-ignored (sensitive, locale!)
   - Passwords, API keys, tokens, testPassword, adminPassword, clientSecret
   - Machine-specific or environment-specific secrets
   - Create locally if needed (never commit!)

4. **test/config/local.json** ⚠️ Git-ignored (machine-specific)
   - Developer machine overrides
   - Local port mappings, custom credentials
   - Optional, used for local development variations

### How PropertiesManager Works

```javascript
// After propertiesmanager loads and NODE_ENV=test:
const pm = require('propertiesmanager').conf;
```

This means:
```json
{
  "test": {
    "keycloak": {
      "baseUrl": "https://...",
      "realmName": "express-middleware-test"
    }
  }
}
```

Becomes accessible as:
```javascript
pm.keycloak.baseUrl       // ✓ Works
pm.keycloak.realmName     // ✓ Works
pm.test.keycloak.baseUrl  // ✗ Won't work (structure is flattened)
```

## Required Configuration Keys

### test.keycloak.baseUrl

The Keycloak server URL for testing.

```json
{
  "test": {
    "keycloak": {
      "baseUrl": "https://smart-dell-sml.crs4.it:8443"
    }
  }
}
```

**Values**:
- Local HTTP: `http://localhost:8080`
- Local HTTPS: `https://localhost:8443`
- Remote: `https://keycloak.example.com:8443`

### test.keycloak.realmName

The realm name for testing (auto-created by setup).

```json
{
  "test": {
    "keycloak": {
      "realmName": "express-middleware-test"
    }
  }
}
```

### test.keycloak.clientId

The client ID for testing (auto-created by setup).

```json
{
  "test": {
    "keycloak": {
      "clientId": "express-middleware-test-client"
    }
  }
}
```

### test.keycloak.username (Admin)

Admin username for realm/client initialization.

```json
{
  "test": {
    "keycloak": {
      "username": "admin"
    }
  }
}
```

### test.keycloak.password (Admin) ⚠️ SENSITIVE

Admin password for realm/client initialization. **Should be in secrets.json**:

```json
{
  "test": {
    "keycloak": {
      "password": "admin"
    }
  }
}
```

### test.keycloak.grantType

OAuth2 grant type for admin authentication.

```json
{
  "test": {
    "keycloak": {
      "grantType": "password"
    }
  }
}
```

## Example Configuration Files

### default.json (Committed)

```json
{
  "production": {
    "keycloak": {
      "baseUrl": "http://localhost:8080",
      "realmName": "express-middleware-test",
      "clientId": "express-middleware-test-client",
      "username": "admin",
      "grantType": "password"
    }
  },
  "test": {
    "keycloak": {
      "baseUrl": "https://smart-dell-sml.crs4.it:8443",
      "realmName": "express-middleware-test",
      "clientId": "express-middleware-test-client",
      "username": "admin",
      "grantType": "password"
    }
  }
}
```

### secrets.json (Git-ignored)

```json
{
  "production": {
    "keycloak": {
      "password": "production-admin-password"
    }
  },
  "test": {
    "keycloak": {
      "password": "test-admin-password"
    }
  }
}
```

### local.json (Git-ignored, Optional)

Machine-specific overrides:

```json
{
  "test": {
    "keycloak": {
      "baseUrl": "http://localhost:8080"
    }
  }
}
```

## Setup Script Auto-Configuration

The `npm run setup-keycloak` script automatically:

1. **Detects deployment location** (local or remote)
2. **Determines HTTPS readiness** (checks for certificates)
3. **Constructs correct baseUrl**:
   - Local HTTP: `http://localhost:8080`
   - Local HTTPS: `https://localhost:8443`
   - Remote SSH: `https://remote.host:8443` (or custom port)
4. **Updates test/config/default.json** with correct baseUrl
5. **Starts Keycloak container** and verifies connectivity

After setup completes, `npm test` automatically uses the configured baseUrl.

## Security Rules

### ✅ DO

- ✓ Commit `default.json` with safe, non-sensitive defaults
- ✓ Add `secrets.json` to `.gitignore` for passwords
- ✓ Use environment variables for production secrets
- ✓ Keep `default.json` in sync with required keys

### ❌ DON'T

- ✗ Commit admin passwords to version control
- ✗ Commit production credentials anywhere
- ✗ Store API keys or tokens in default.json
- ✗ Share secrets.json in repositories or PRs

## Runtime Access

From test files:

```javascript
// test helpers/config.js provides this
const { getKeycloakConfig, getBaseUrl } = require('./helpers/config');

const config = getKeycloakConfig();
// {
//   baseUrl: "https://...",
//   realmName: "express-middleware-test",
//   clientId: "express-middleware-test-client",
//   username: "admin",
//   password: "admin"
// }

const baseUrl = getBaseUrl();
// "https://..."
```

## Troubleshooting

### "Cannot find module 'propertiesmanager'"

```bash
cd test
npm install
```

### PropertiesManager not loading config

```bash
# Verify NODE_ENV is set
echo $NODE_ENV

# Verify config files exist
ls -la test/config/

# Check syntax of JSON files
cat test/config/default.json | jq .
```

### "ENOENT: no such file or directory"

- Ensure running from project root: `pwd` should show keycloak-express-middleware
- Verify config files have correct relative paths
- Check file permissions: `ls -la test/config/`

### Tests reach wrong Keycloak instance

1. Check `test/config/default.json` baseUrl
2. Set `NODE_ENV=test` explicitly: `NODE_ENV=test npm test`
3. Verify active config: Run `npm run setup-keycloak` to update baseUrl
4. Check for `secrets.json` or `local.json` overrides

### Mixing up environments

PropertiesManager uses `NODE_ENV` to select configuration block:
- For regular testing: Use `NODE_ENV=test` (done automatically by test runner)
- For production: Comment out test scripts in package.json, set `NODE_ENV=production`
- Keep them completely separate in config files

## Migration to Different Keycloak

1. Update `test/config/default.json` baseUrl
2. Run: `npm run setup-keycloak` (will validate and update)
3. Run: `npm test` to verify connectivity

Or manually update the baseUrl and ensure Keycloak is reachable from your network.
