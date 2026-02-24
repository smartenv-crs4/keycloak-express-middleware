# Docker Keycloak Setup

This folder contains the Keycloak deployment infrastructure for testing keycloak-express-middleware.

## Quick Start

```bash
# From project root
npm run setup-keycloak

# Follow the interactive prompts:
# 1. Choose deployment location (Local / Remote SSH)
# 2. Choose protocol (HTTP / HTTPS)
# 3. Script will start Keycloak and update configuration
```

After setup completes, verify Keycloak is running:

```bash
npm test
```

## Contents

- **setup-keycloak.js**: Interactive setup script (412 lines)
- **docker-compose.yml**: Local HTTP deployment (localhost:8080)
- **docker-compose-https.yml**: Local HTTPS deployment (localhost:8443)
- **certs/**: SSL certificate folder (see [certs/README.md](certs/README.md))

## Deployment Methods

### 1. Local HTTP (Fastest)

**Best for**: Quick development and testing

```bash
npm run setup-keycloak
→ Choose: Local
→ Choose: HTTP
```

**What happens**:
- Starts Keycloak on `http://localhost:8080`
- No certificate setup needed
- Admin credentials: admin/admin (default)
- DB: Dev-memory (in-process, data lost on restart)

**Verify**:
```bash
curl http://localhost:8080/health
# Output: {"status":"UP"}
```

### 2. Local HTTPS (Production-like)

**Best for**: Testing SSL/TLS scenarios locally

```bash
npm run setup-keycloak
→ Choose: Local
→ Choose: HTTPS
```

**Requirements**: SSL certificates in `certs/` folder
- `keycloak.crt`: Certificate file
- `keycloak.key`: Private key
- See [certs/README.md](certs/README.md) for setup

**What happens**:
- Starts Keycloak on `https://localhost:8443` AND `http://localhost:8080`
- Serves HTTPS on port 8443 with provided certificate
- Uses docker-compose-https.yml
- Admin credentials: admin/admin (default)

**Verify**:
```bash
curl -k https://localhost:8443/health
# Output: {"status":"UP"}
```

### 3. Remote SSH Deployment

**Best for**: Testing against shared/production Keycloak instances

```bash
npm run setup-keycloak
→ Choose: Remote
→ Enter SSH host, user, port
→ Choose: HTTP or HTTPS
```

**Requirements**:
- SSH access to remote server
- Docker and Docker Compose installed on remote
- User with Docker permissions

**What happens**:
- Copies docker-compose files to remote server
- Creates certs folder on remote (if HTTPS)
- Starts Keycloak container remotely
- Validates connection and updates test config

**Security Notes**:
- SSH connection used for deployment only
- Credentials from interactive prompt (not stored)
- Network access required to Keycloak port from your machine

## File Details

### docker-compose.yml

```yaml
version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    
    environment:
      # Admin user
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
      
      # Feature flags
      KC_FEATURES: 'admin-fine-grained-authz:v1,client-policies'
      
      # HTTP only
      KC_HTTP_ENABLED: 'true'
      KC_HOSTNAME: localhost
    
    ports:
      - "8080:8080"
    
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    
    command: start-dev
```

**Key points**:
- `start-dev`: Development mode (no persistent database setup needed)
- Health check validates Keycloak readiness
- Port 8080 mapped for HTTP access

### docker-compose-https.yml

```yaml
version: '3.8'

services:
  keycloak:
    # ... (same as above) ...
    
    environment:
      # Add HTTPS certificate configuration
      KC_HTTPS_CERTIFICATE_FILE: /etc/x509/https/keycloak.crt
      KC_HTTPS_CERTIFICATE_KEY_FILE: /etc/x509/https/keycloak.key
    
    ports:
      - "8080:8080"      # HTTP still available
      - "8443:8443"      # HTTPS on 8443
    
    volumes:
      - ./certs/keycloak.crt:/etc/x509/https/keycloak.crt:ro
      - ./certs/keycloak.key:/etc/x509/https/keycloak.key:ro
    
    healthcheck:
      test: ["CMD", "curl", "-f", "-k", "https://localhost:8443/health"]
      # ... (rest same) ...
    
    command: start
```

**Key points**:
- Certificates mounted as read-only volumes
- Both HTTP and HTTPS ports available
- Health check uses HTTPS endpoint

### setup-keycloak.js

Interactive script that:

1. **Validates docker-compose**
   - Checks for `docker-compose` or `docker compose` command
   - Ensures Docker is running

2. **Detects deployment location**
   - Interactive prompt: Local or Remote?
   - For remote: Collects SSH details

3. **Validates certificates (if HTTPS)**
   - Checks for `keycloak.crt` and `keycloak.key` in certs/
   - Prevents HTTPS without certificates
   - Offers fallback to HTTP

4. **Starts Keycloak**
   - Local: Uses specified docker-compose file
   - Remote: Copies files via SCP, starts via SSH
   - Waits for health check (30-second timeout)

5. **Updates configuration**
   - Modifies `test/config/default.json`
   - Sets baseUrl to deployed instance
   - Preserves other configuration keys

6. **Verifies connectivity**
   - Tests token endpoint reachability
   - Shows success/failure summary

## Control Commands

### Check Keycloak Status

```bash
# Docker status
docker ps | grep keycloak

# Health check
curl -f http://localhost:8080/health

# Admin console
# Browser: http://localhost:8080/admin
```

### View Logs

```bash
# Real-time logs
docker logs -f keycloak

# Last 50 lines
docker logs --tail 50 keycloak
```

### Stop Keycloak

```bash
cd test/docker-keycloak

# Stop HTTP deployment
docker-compose down

# Stop HTTPS deployment
docker-compose -f docker-compose-https.yml down

# Stop and remove volumes (WARNING: data loss)
docker-compose down -v
```

### Restart Keycloak

```bash
cd test/docker-keycloak

# For HTTP
docker-compose restart

# For HTTPS
docker-compose -f docker-compose-https.yml restart
```

## Troubleshooting

### "docker-compose: command not found"

Update to Docker Desktop 1.28+ or install separately:

```bash
# macOS
brew install docker-compose

# Or use docker as prefix
docker compose version
```

The setup script auto-detects which version you have.

### "Keycloak certificate validation error"

When using HTTPS:

1. **Verify certificates exist**
   ```bash
   ls -la certs/
   # Should show: keycloak.crt, keycloak.key
   ```

2. **Check permissions**
   ```bash
   chmod 644 certs/keycloak.crt
   chmod 600 certs/keycloak.key
   ```

3. **Verify certificate validity**
   ```bash
   openssl x509 -in certs/keycloak.crt -text -noout
   ```

4. **Regenerate if needed**
   - See [certs/README.md](certs/README.md)

### "Port 8080 already in use"

Change port mapping in docker-compose file:

```yaml
# Change from 8080:8080 to available port, e.g., 9080:8080
ports:
  - "9080:8080"  # Access on localhost:9080
```

Then update `test/config/default.json`:
```json
{
  "test": {
    "keycloak": {
      "baseUrl": "http://localhost:9080"
    }
  }
}
```

### "Keycloak won't start (status: unstarted)"

Check Docker and logs:

```bash
# Verify Docker is running
docker version

# Check Keycloak logs for errors
docker logs keycloak

# Common issues:
# - Insufficient disk space
# - Memory constraints
# - Port conflicts
# - Invalid environment variables
```

### "Connection refused (Remote SSH)"

Verify SSH access:

```bash
# Test SSH connection
ssh -v user@host docker version

# Verify Docker on remote
ssh user@host docker ps

# Check firewall
ssh user@host sudo ufw status
```

### "Tests can't reach Keycloak"

Verify network and configuration:

```bash
# Check what URL is configured
cat test/config/default.json | jq .test.keycloak.baseUrl

# Test direct curl
curl -v $(cat test/config/default.json | jq -r .test.keycloak.baseUrl)/health

# For HTTPS, include -k flag (self-signed cert)
curl -k -v https://localhost:8443/health
```

## Advanced Usage

### Custom Keycloak Version

Edit docker-compose file before running:

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:25.0.7  # Specify version
```

### Persistent Database (PostgreSQL)

Replace dev-memory with PostgreSQL:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  keycloak:
    # ... existing config ...
    environment:
      # Use PostgreSQL
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: password
    depends_on:
      - postgres

volumes:
  postgres_data:
```

### Custom Feature Flags

Modify `KC_FEATURES` environment variable:

```yaml
environment:
  KC_FEATURES: 'admin-fine-grained-authz:v1,client-policies,organization'
```

Available flags: `admin-fine-grained-authz:v1`, `organization`, `client-policies`, etc.

### Environment-Specific Configuration

Create separate compose files:

- `docker-compose.yml` - HTTP (default)
- `docker-compose-https.yml` - HTTPS
- `docker-compose-production.yml` - Production-like (PostgreSQL, features)
- `docker-compose-ci.yml` - CI/CD optimized

## Security Notes

### Development Only

- Default credentials (admin/admin) are NOT secure
- Self-signed certificates used for testing
- `NODE_TLS_REJECT_UNAUTHORIZED=0` allows self-signed

### For Production

- Change admin credentials immediately
- Use valid certificates (Let's Encrypt or CA-signed)
- Use persistent database (PostgreSQL, MySQL)
- Enable all security features
- Set appropriate resource limits
- Configure network policies
- Use Docker secrets for sensitive data

## Related Documentation

- [Deployment Guide](../docs/deployment.md) - Detailed deployment steps
- [Keycloak Setup](../docs/keycloak-setup.md) - Server configuration
- [Test Configuration](../docs/test-configuration.md) - Configuration management
- [Testing Guide](../docs/testing.md) - Running tests
- [Certificates Setup](certs/README.md) - SSL/TLS configuration

## Next Steps

1. **Setup Keycloak**: `npm run setup-keycloak`
2. **Run tests**: `npm test`
3. **Check logs**: `docker logs keycloak`
4. **Access admin**: `http://localhost:8080/admin`
5. **Verify realm created**: Check "express-middleware-test" realm (if tests passed)

---

For more help, see the [Documentation Index](../docs/README.md)
