# Keycloak Setup and Feature Flags

This guide describes the Keycloak server setup required for testing keycloak-express-middleware.

## Minimum Recommended Versions

- **Keycloak**: 23+ (26.x recommended for best OIDC support)
- **Admin User**: Required in `master` realm
- **HTTPS**: Strongly recommended outside local development

## Required Feature Flags

The test suite validates OIDC flows and expects standard OAuth2/OIDC compliance. No special feature flags are strictly required, but standard features should be enabled:

```bash
# Default (inclued in Keycloak 26+, recommended for all versions)
--features=admin-fine-grained-authz:v1,client-policies
```

### Notes

- `admin-fine-grained-authz:v1`: Required for realm/client initialization during test setup
- `client-policies`: Recommended for client validation during test realm creation

## Docker Deployment Examples

### Local HTTP (docker-compose.yml)

```yaml
version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_FEATURES: 'admin-fine-grained-authz:v1,client-policies'
    ports:
      - "8080:8080"
    command: start-dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

### Local HTTPS (docker-compose-https.yml)

```yaml
version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      KC_FEATURES: 'admin-fine-grained-authz:v1,client-policies'
      KC_HTTPS_CERTIFICATE_FILE: /etc/x509/https/keycloak.crt
      KC_HTTPS_CERTIFICATE_KEY_FILE: /etc/x509/https/keycloak.key
    ports:
      - "8080:8080"
      - "8443:8443"
    volumes:
      - ./certs/keycloak.crt:/etc/x509/https/keycloak.crt:ro
      - ./certs/keycloak.key:/etc/x509/https/keycloak.key:ro
    command: start
    healthcheck:
      test: ["CMD", "curl", "-f", "-k", "https://localhost:8443/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

## Authentication Setup

### Default Credentials (Development)

The docker-compose files use:
- **Username**: `admin`
- **Password**: `admin`
- **Realm**: `master`

### For Production

Change credentials:
1. Edit docker-compose files before first run
2. Set `KEYCLOAK_ADMIN` and `KEYCLOAK_ADMIN_PASSWORD` environment variables
3. Update test configuration if needed

## Server Readiness Verification

After Keycloak starts, verify:

### 1. Health Check

```bash
# HTTP
curl -f http://localhost:8080/health

# HTTPS (with self-signed cert)
curl -k https://localhost:8443/health
```

### 2. Admin Token Issuance

```bash
# HTTP
curl -X POST http://localhost:8080/realms/master/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&client_id=admin-cli&grant_type=password"

# HTTPS
curl -k -X POST https://localhost:8443/realms/master/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=admin&client_id=admin-cli&grant_type=password"
```

### 3. Features Enabled

```bash
# Check feature support
curl http://localhost:8080/admin/serverinfo | jq '.features'
```

## Test Realm Auto-Initialization

When running `npm test`:
1. Test setup attempts to create test realm `express-middleware-test`
2. Creates test client `express-middleware-test-client`
3. Configures OIDC scopes and protocol mappers
4. If Keycloak unavailable, continues with unit tests only

If realm already exists, tests reuse it (idempotent).

## Custom Configuration

To point tests at different Keycloak instance:

1. Update `test/config/default.json`:
```json
{
  "test": {
    "keycloak": {
      "baseUrl": "https://custom.keycloak.com:8443"
    }
  }
}
```

2. Run: `npm test`

## Troubleshooting

### Keycloak won't start

```bash
# Check logs
docker logs keycloak

# Verify image exists
docker images | grep keycloak

# Re-pull latest
docker pull quay.io/keycloak/keycloak:latest
```

### Health check fails

```bash
# Wait longer (first start can take 30+ seconds)
docker ps  # check STATUS column

# Check specific ports
netstat -anlp | grep 8080
netstat -anlp | grep 8443
```

### Admin login fails

- Verify credentials in docker-compose file
- Check Keycloak logs: `docker logs keycloak`
- Ensure HTTP/HTTPS port is correctly mapped

### Tests can't reach Keycloak

- Verify `test/config/default.json` baseUrl matches Keycloak URL
- Check network connectivity: `curl -v baseUrl/health`
- For HTTPS with self-signed: Node.js test setup handles this automatically
- For browser: Add certificate to system trust store if needed

## OIDC Compliance Notes

Keycloak supports all standard OAuth2/OIDC flows tested by keycloak-express-middleware:
- **Authorization Code**: Native support, PKCE optional
- **Client Credentials**: Supported via service accounts
- **Password Grant**: Supported in dev mode (configurable)
- **Token Refresh**: Full support with refresh_token scope
- **PKCE**: Full support for Authorization Code + PKCE flow

No special Keycloak configuration is needed beyond basic OIDC defaults.
