# OIDC Migration Status

## Summary

OIDC runtime helpers are now documented and implemented in `keycloak-express-middleware`, with test coverage and integration guidance aligned to the current constructor-based API.

## Implemented Scope

The following helper methods are part of the migration scope:

- `generateAuthorizationUrl(options)`
- `loginWithCredentials(credentials)`
- `loginPKCE(credentials)`

These methods are documented in:

- `docs/api/oidc-token-endpoint.md`
- `docs/OIDC_INTEGRATION_GUIDE.md`

## Validation Status

- OIDC helper methods documented with parameters, return values, and examples
- Integration guide updated to reflect constructor-based initialization
- Naming consistency aligned with code (`keycloakConfig`, `keycloakOptions`)
- Error handling guidance included for common runtime failures

## Design Rationale

OIDC login flow helpers belong in the Express middleware package because they are coupled to request/session lifecycle and application routing concerns.

| Aspect | keycloak-api-manager | keycloak-express-middleware |
|--------|----------------------|-----------------------------|
| Primary purpose | Admin API orchestration | Application authentication and authorization |
| Session/cookie awareness | No | Yes |
| Express routing integration | No | Yes |
| OIDC runtime flow fit | Limited | Native |

## Compatibility Notes

- The migration is additive for middleware users.
- Existing middleware behavior remains unchanged.
- Runtime requirements remain compatible with Node.js 18+ (`fetch` available globally).

## Recommended Next Steps

1. Validate your local environment with `npm test`.
2. Review `docs/OIDC_INTEGRATION_GUIDE.md` for implementation-level guidance.
3. Use `docs/api-reference.md` as the canonical API entry point.
