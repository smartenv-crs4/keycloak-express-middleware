# Documentation

Complete documentation for keycloak-express-middleware.

## Quick Start

1. Review package overview in [Root README](../README.md)
2. Read [API Reference](api-reference.md)
3. Use general docs for architecture, setup, deployment, and testing

## Documentation Map

### API Reference

- [API Reference (Index)](api-reference.md)
- [API - Configuration and Initialization](api/configuration.md)
- [API - Route Protection](api/route-protection.md)
- [API - Authorization Services](api/authorization-services.md)
- [API - Token Decode Helpers](api/token-decode-helpers.md)
- [API - OIDC Token Endpoint Helpers](api/oidc-token-endpoint.md)
- [API - Session and Navigation](api/session-and-navigation.md)

### General Documentation

- [Architecture and Runtime](architecture.md)
- [Deployment Guide](deployment.md)
- [Keycloak Setup](keycloak-setup.md)
- [Test Configuration](test-configuration.md)
- [Testing Environment and Scripts](testing-environment.md)
- [Testing Guide](testing.md)
- [OIDC Integration Guide](OIDC_INTEGRATION_GUIDE.md)
- [Migration Status](MIGRATION_STATUS.md)

## Security Notes

- `test/config/secrets.json` contains local secrets and must never be committed.
- Use `test/config/secrets.json.example` as template.
- For HTTPS tests with self-signed certs, `NODE_TLS_REJECT_UNAUTHORIZED=0` is acceptable only in test/local environments.
