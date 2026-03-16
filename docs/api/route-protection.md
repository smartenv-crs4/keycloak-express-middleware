# Route Protection API

Authentication and role-based authorization middleware.

**Namespace:** instance methods on `keycloakAdapter`

## Table of Contents

- [protectMiddleware(conditions)](#protectmiddlewareconditions)
- [customProtectMiddleware(fn)](#customprotectmiddlewarefn)

---

## protectMiddleware(conditions)

Protect route by requiring authentication and optional role checks.

**Syntax:**
```javascript
app.get('/private', keycloak.protectMiddleware(conditions), handler);
```

### Parameters

#### `conditions` (string | string[] | function) - Optional

- `undefined` / `null`: authentication-only protection
- `string`: single role check
- `string[]`: any-of role check (OR logic)
- `function(token, req) => boolean`: custom synchronous authorization logic

Role formats:

- `admin` -> client role of configured client
- `realm:admin` -> realm role
- `otherClient:editor` -> role in specific client

### Returns

Express middleware function.

### Behavior

- Function condition: delegated to `keycloak.protect(conditions)`.
- Empty condition: delegated to `keycloak.protect()`.
- String or array: normalized to array and checked with `token.hasRole(role)`.

### Examples

```javascript
// Authentication only
app.get('/private', keycloak.protectMiddleware(), (req, res) => {
  res.send('Authenticated');
});

// Static role
app.get('/admin', keycloak.protectMiddleware('admin'), (req, res) => {
  res.send('Admin role required');
});

// Multiple accepted roles (OR)
app.get('/ops', keycloak.protectMiddleware(['realm:ops', 'realm:admin']), (req, res) => {
  res.send('Ops or Admin role accepted');
});

// Custom logic
app.get('/editor', keycloak.protectMiddleware((token, req) => {
  return token.hasRealmRole('editor') && req.headers['x-channel'] === 'web';
}), (req, res) => {
  res.send('Custom authorization passed');
});
```

---

## customProtectMiddleware(fn)

Protect route using a dynamic role string generated from request context.

**Syntax:**
```javascript
app.get('/route/:id', keycloak.customProtectMiddleware(fn), handler);
```

### Parameters

#### `fn` (function(req, res) => string) - Required

Generates the role expression passed to Keycloak at runtime.

### Returns

Express middleware function.

### Behavior

- Evaluates `fn(req, res)`.
- Passes resulting string to `keycloak.protect(protectionString)`.

### Example

```javascript
app.get('/:id/isAdmin', keycloak.customProtectMiddleware((req) => {
  return `${req.params.id}`;
}), (req, res) => {
  res.send('Authorized by dynamic role check');
});
```

## Accessing Decoded Token in Handlers

After successful authentication/authorization, decoded token content is available under:

- `req.kauth.grant.access_token.content`

Typical claims used in handlers:

- `preferred_username`
- `email`
- `scope`
- `realm_access.roles`
- `resource_access`
