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
- If loginWithCredentials is used with grant_type=password, enable Direct Access Grants on the client.
- This is OAuth2 Resource Owner Password Credentials Grant support for that client.
- loginPKCE (authorization_code + code_verifier) does not require Direct Access Grants.

Quick verification command:

- npm test
