# Deployment Guide (Local and Remote)

This guide covers test/development Keycloak deployment options for testing keycloak-express-middleware.

## Quick Start

Run the interactive setup script:

```bash
npm run setup-keycloak
```

This will guide you through deployment options and automatically configure the test environment.

## Deployment Options

### Local HTTP (Fast Development)

- **Best for**: Quick local testing without certificate setup
- **Port**: `http://localhost:8080`
- **Command**: `npm run setup-keycloak` → Choose "Local" → "HTTP"
- **Requirements**: Docker and Docker Compose
- **Speed**: Starts immediately, no certificate validation needed

### Local HTTPS (Production-like Testing)

- **Best for**: Testing SSL/TLS scenarios locally
- **Port**: `https://localhost:8443`
- **Command**: `npm run setup-keycloak` → Choose "Local" → "HTTPS"
- **Requirements**: 
  - Docker and Docker Compose
  - SSL certificates (see [Certificates Setup](#certificates-setup))
- **Notes**: Self-signed certificates are fine for testing

### Remote SSH Deployment

- **Best for**: Testing against shared or production Keycloak instances
- **Command**: `npm run setup-keycloak` → Choose "Remote" → Provide SSH details
- **Requirements**:
  - Remote server with Docker/Docker Compose
  - SSH access and credentials
  - Network access to remote host
- **Process**:
  1. Script copies docker-compose files to remote server
  2. Starts Keycloak container remotely
  3. Validates endpoint reachability
  4. Updates test configuration with remote URL

## Certificates Setup

See [certs/README.md](../test/docker-keycloak/certs/README.md) for detailed instructions on:
- Generating self-signed certificates
- Using Let's Encrypt certificates
- Certificate format requirements

## Verification Checklist

After deployment, verify:

- [ ] Container is running and healthy
  ```bash
  docker ps | grep keycloak
  ```

- [ ] Admin console accessible
  - Local: `http://localhost:8080/admin`
  - Remote: Check URL shown after `npm run setup-keycloak`

- [ ] Login works with default credentials
  - Username: `admin`
  - Password: `admin` (default in docker-compose files)

- [ ] Test realm can be created
  - Run: `npm test` (if setup was successful, realm will be created)

## Operational Tips

1. **Port conflicts**: If ports 8080/8443 are in use:
   - Edit `docker-compose.yml` or `docker-compose-https.yml`
   - Change port mappings
   - Update `test/config/default.json` baseUrl accordingly

2. **Self-signed certificate warnings**: 
   - Tests handle this automatically (`NODE_TLS_REJECT_UNAUTHORIZED=0`)
   - For browser testing, add certificate to trusted store

3. **Network issues with remote deployment**:
   - Verify SSH access: `ssh user@host docker ps`
   - Check firewall rules on remote host
   - Ensure Keycloak port is reachable from your machine

4. **Graceful fallback**:
   - If Keycloak is unavailable, unit tests still run
   - Server features (realm initialization) are skipped with a warning
   - Full integration testing requires Keycloak to be running

## Stopping Keycloak

### Local Deployment

```bash
cd test/docker-keycloak
docker-compose down  # for HTTP
# or
docker-compose -f docker-compose-https.yml down  # for HTTPS
```

### Remote Deployment

```bash
# SSH to the remote server and run:
docker-compose -f ~/keycloak-express-middleware/docker-compose.yml down
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs keycloak

# Verify ports are free
lsof -i :8080
lsof -i :8443
```

### Network unreachable (Remote SSH)

- Verify firewall allows port 8443/8080 from your machine
- Check DNS resolution: `nslookup remote.host.com`
- Test SSH: `ssh user@host echo OK`

### Certificate errors

- Verify certificate files exist: `ls -la test/docker-keycloak/certs/`
- Check file permissions: `chmod 644 certs/keycloak.crt` and `chmod 600 certs/keycloak.key`
- Regenerate if needed: Follow [certs/README.md](../test/docker-keycloak/certs/README.md)

### PropertiesManager not loading correct URL

- Verify `NODE_ENV=test` is set (test runner does this automatically)
- Check `test/config/default.json` has correct baseUrl
- Manually verify: `cat test/config/default.json` to see loaded values
