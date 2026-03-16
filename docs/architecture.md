# Architecture and Runtime

This package exposes a constructor-based middleware class for Express and Keycloak integration.

## Runtime Model

The package export is a class, not a middleware factory function.

- Main export: keycloakExpressMiddleware
- Backward-compatible named alias: keycloackAdapter (legacy typo)

Typical initialization:

1. Create an Express app
2. Instantiate middleware with constructor
3. Define protected routes using instance methods

## Constructor-Centered Initialization

Current initialization entrypoint:

- new keycloakAdapter(app, keycloakConfig, keycloakOptions)

The constructor currently:

- stores realm and auth server values
- stores OIDC helper values (clientId, clientSecret)
- wires express-session with MemoryStore when session options are provided
- creates keycloak-connect instance
- registers keycloak middleware on the app

## Public API Surface

Route protection and authorization:

- protectMiddleware
- customProtectMiddleware
- enforcerMiddleware
- customEnforcerMiddleware

Token helper middleware:

- encodeTokenRole
- encodeTokenPermission

Session and navigation helpers:

- loginMiddleware
- logoutMiddleware
- login
- logout
- redirectToUserAccountConsole

OIDC token endpoint helpers:

- generateAuthorizationUrl
- loginWithCredentials
- loginPKCE

## OIDC Helper Placement

OIDC helpers are instance methods on the middleware class in index.js.
They are not exported as top-level standalone functions from package root.

Use:

- keycloakInstance.generateAuthorizationUrl(...)
- keycloakInstance.loginWithCredentials(...)
- keycloakInstance.loginPKCE(...)

Instead of importing those methods directly from require('keycloak-express-middleware').

## Package Structure

Relevant files:

- index.js: class implementation and exports
- oidc-methods.js: helper source module used as implementation reference and test support
- docs/api/*.md: API reference pages aligned with current class methods
- test/*.test.js: integration and helper behavior tests

## Testing Runtime Notes

Default test pipeline:

- npm test

This flow performs:

1. test helper setup script execution
2. test workspace dependency installation
3. mocha suite execution from test workspace

For testing workflow details, use:

- docs/testing-environment.md
- docs/testing.md
