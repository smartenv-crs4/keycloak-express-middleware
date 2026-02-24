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
  # Documentazione keycloak-express-middleware

  Questa directory contiene la documentazione tecnica completa del pacchetto, inclusi:

  - Setup e deployment ([deployment.md](deployment.md))
  - Requisiti e configurazione Keycloak ([keycloak-setup.md](keycloak-setup.md))
  - Gestione configurazione ([test-configuration.md](test-configuration.md))
  - Architettura e moduli ([architecture.md](architecture.md))
  - **Test e infrastruttura di test** ([testing.md](testing.md))

  Consulta il [README principale](../README.md) per overview, installazione e utilizzo base.

  ---

  ## Indice documentazione

  - [deployment.md](deployment.md): guida setup e deployment
  - [keycloak-setup.md](keycloak-setup.md): requisiti server Keycloak
  - [test-configuration.md](test-configuration.md): gestione configurazione
  - [architecture.md](architecture.md): architettura e moduli
  - [testing.md](testing.md): guida test automatizzati

  ---

  ## Note sicurezza

  ⚠️ **Attenzione:** Il file `test/config/secrets.json` contiene tutte le password e i segreti sensibili. NON va mai committato! Usa `secrets.json.example` come template e personalizza solo in locale.
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
