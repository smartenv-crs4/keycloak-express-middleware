# OIDC Token Endpoint Helpers API

Helper methods for OAuth2/OIDC token endpoint interactions and PKCE flow.

**Namespace:** instance methods on `keycloakAdapter`

## Table of Contents

- [generateAuthorizationUrl(options)](#generateauthorizationurloptions)
- [loginWithCredentials(credentials)](#loginwithcredentialscredentials)
- [loginPKCE(credentials)](#loginpkcecredentials)

---

## generateAuthorizationUrl(options)

Generate PKCE authorization URL and challenge material.

**Syntax:**
```javascript
const pkceFlow = keycloak.generateAuthorizationUrl(options);
```

### Parameters

#### `options` (Object) - Optional object, with required redirect URI

| Field | Type | Required | Description |
|------|------|----------|-------------|
| `redirect_uri` | string | Required* | Callback URL |
| `redirectUri` | string | Required* | Alias of `redirect_uri` |
| `scope` | string | Optional | Default: `openid profile email` |
| `state` | string | Optional | Custom CSRF state; auto-generated if omitted |

`*` At least one between `redirect_uri` and `redirectUri` is required.

### Returns

Object with:

- `authUrl` (string)
- `state` (string)
- `codeVerifier` (string)

### Example

```javascript
const pkceFlow = keycloak.generateAuthorizationUrl({
  redirect_uri: 'https://app.example.com/auth/callback'
});

req.session.pkce_state = pkceFlow.state;
req.session.pkce_verifier = pkceFlow.codeVerifier;
res.redirect(pkceFlow.authUrl);
```

---

## loginWithCredentials(credentials)

Generic token endpoint helper for OAuth2 grants.

**Syntax:**
```javascript
const tokens = await keycloak.loginWithCredentials(credentials);
```

### Parameters

#### `credentials` (Object) - Required

Common fields:

- `grant_type` (required)
- `username`, `password` (password grant)
- `refresh_token` (refresh grant)
- `code`, `redirect_uri` (authorization_code grant)
- `client_id`, `client_secret` (optional; auto-filled from adapter config when absent)
- `scope` (optional)

### Returns

Promise resolving to Keycloak token payload (`access_token`, `refresh_token`, `id_token`, ...).

### Example

```javascript
const tokens = await keycloak.loginWithCredentials({
  grant_type: 'password',
  username: 'user@example.com',
  password: 'password123',
  scope: 'openid profile email'
});
```

---

## loginPKCE(credentials)

Exchange authorization code and PKCE verifier for tokens.

**Syntax:**
```javascript
const tokens = await keycloak.loginPKCE(credentials);
```

### Parameters

#### `credentials` (Object) - Required

| Field | Required | Notes |
|------|----------|-------|
| `code` | Required | Authorization code from callback |
| `redirect_uri` / `redirectUri` | Required | Must match initial authorize request |
| `code_verifier` / `codeVerifier` | Required | PKCE verifier saved in session |
| `client_id` / `clientId` | Optional | Override client ID |
| `client_secret` / `clientSecret` | Optional | Override client secret |
| `scope` | Optional | Additional scope |

### Returns

Promise resolving to token payload.

### Example

```javascript
app.get('/auth/callback', async (req, res) => {
  const tokens = await keycloak.loginPKCE({
    code: req.query.code,
    redirect_uri: 'https://app.example.com/auth/callback',
    code_verifier: req.session.pkce_verifier
  });

  res.json({
    tokenType: tokens.token_type,
    expiresIn: tokens.expires_in
  });
});
```

## Error Conditions

These methods throw/reject when:

- Adapter was initialized without required OIDC fields
- Required PKCE parameters are missing
- Keycloak token endpoint returns non-2xx
- Response payload contains OAuth2 error information
