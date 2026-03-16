# OIDC Integration Guide

This root-level guide is intentionally kept short to avoid drift.
The canonical and maintained version is:

- docs/OIDC_INTEGRATION_GUIDE.md

Current OIDC helper methods in code are:

- generateAuthorizationUrl(options)
- loginWithCredentials(credentials)
- loginPKCE(credentials)

Important alignment notes with current implementation:

- Initialization is constructor-based, not configure-based.
- Use a middleware instance created with:
  new keycloackAdapter(app, keyCloackConfig, keyCloackOptions)
- For generic token endpoint exchange use loginWithCredentials, not login.

Quick verification command:

- npm test
