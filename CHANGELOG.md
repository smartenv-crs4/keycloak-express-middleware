# Changelog

All notable changes to this project will be documented in this file.

## [6.3.0] - 2026-03-18

### Added
- **Outbound Service Helpers** for service-to-service and user-context API calls:
  - `getServiceToken(options)` — Client Credentials token helper with in-memory cache, single-flight refresh, and configurable validity window
  - `callProtectedApi(options)` — Outbound HTTP helper with auth modes (`service`, `user`, `passthrough`, `none`), normalized response shape, timeout support, and automatic one-time retry on `401` in service mode
- **TypeScript coverage** for outbound helpers:
  - `ServiceTokenOptions`, `ServiceTokenResult`
  - `CallProtectedApiOptions`, `CallProtectedApiResult`

### Documentation
- Expanded README API reference with complete sections for:
  - `getServiceToken(options)`
  - `callProtectedApi(options)`
- Added practical service-integration examples and cross-links to recipes
- Updated `docs/recipes.md` Recipe 5 with production-style outbound flow, fallback mapping, and error shaping patterns

### Tests
- Added unit tests for outbound helper behavior:
  - token cache reuse
  - single-flight concurrency behavior
  - `401` refresh+retry path in `service` auth mode
  - user-token auth mode behavior

## [6.2.0] - 2026-03-18

### Added
- **Helper Utilities for Auth & Scope Management** — New imperative methods to simplify common token/scope operations:
  - `getTokenClaims(req)` — Extract decoded JWT claims from request
  - `isAuthenticated(req)` — Check if user's access token is valid
  - `getScopes(scopeInputOrReq)` — Normalize and retrieve scope list from string, array, or request
  - `hasScopeFromRequest(req, requiredScope)` — Check single scope from request token
  - `hasScopesFromRequest(req, requiredScopes, mode)` — Check multiple scopes from request token (all/any mode)
  - `requireScopes(requiredScopes, mode)` — Middleware to enforce scope requirements (returns 403 JSON if missing)
- **TypeScript Definitions** (`index.d.ts`) — Type coverage for all exported functions and middleware
- **CHANGELOG.md** — Centralized changelog for release tracking
- Comprehensive test coverage for all new methods (57 tests passing)

### Documentation
- Updated README with new API documentation and examples
- Clarified Direct Access Grants prerequisites for password grant flow
- Added OIDC integration guide notes

### Dependencies
- `express-session` ^1.19.0
- `keycloak-connect` ^26.1.1

## [6.1.3] - 2026-03-18

### Added
- Scope checking utilities (`hasScope`, `hasScopes`) for imperative token validation
- Direct Access Grants documentation and clarification in guides

### Fixed
- Test workspace installation and execution flow
- Package.json runtime dependencies minimized to reduce surface area

## [6.1.0] — [6.1.2]

See GitHub releases for detailed history.

---

## Versioning

This project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** (X.0.0): Breaking API changes, major feature overhauls
- **MINOR** (0.X.0): New features, helper utilities, backward compatible
- **PATCH** (0.0.X): Bug fixes, docs, internal improvements

## Migration Guides

- See [OIDC_INTEGRATION_GUIDE.md](./docs/OIDC_INTEGRATION_GUIDE.md) for OpenID Connect setup
- See [README.md](./README.md) for API reference and examples
