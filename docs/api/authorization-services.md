# Authorization Services API

Permission-based protection using Keycloak Authorization Services (UMA 2.0 style).

**Namespace:** instance methods on `keycloakAdapter`

## Table of Contents

- [enforcerMiddleware(conditions, options)](#enforcermiddlewareconditions-options)
- [customEnforcerMiddleware(fn, options)](#customenforcermiddlewarefn-options)

---

## enforcerMiddleware(conditions, options)

Check resource permissions using Keycloak authorization policies.

**Syntax:**
```javascript
app.get('/resource', keycloak.enforcerMiddleware(conditions, options), handler);
```

### Parameters

#### `conditions` (string | string[] | function) - Required

- `string` or `string[]`: permission/resource expression(s)
- `function(token, req, callback)` for custom async authorization logic

#### `options` (Object) - Optional

Forwarded to Keycloak enforcer.

| Field | Type | Description |
|------|------|-------------|
| `response_mode` | string | `permissions` (default) or `token` |
| `claims` | Object | Dynamic claim values for policies |
| `resource_server_id` | string | Resource server client ID |

### Returns

Express middleware function.

### Behavior

- String/array mode: delegates to `this.keycloak.enforcer(conditions, options)`.
- Function mode: wraps a helper token object exposing `hasPermission(permission, callback)` and decides via callback boolean.

### Examples

```javascript
// Static permission
app.get('/adminResource', keycloak.enforcerMiddleware('ui-admin-resource'), (req, res) => {
  res.send('Permission granted');
});

// Permission + scope notation
app.get('/writeResource', keycloak.enforcerMiddleware('ui-admin-resource:write'), (req, res) => {
  res.send('Write scope granted');
});

// Custom async authorization
app.get('/adminOrViewer', keycloak.enforcerMiddleware((token, req, done) => {
  token.hasPermission('ui-admin-resource', (isAdmin) => {
    if (isAdmin) return done(true);
    token.hasPermission('ui-viewer-resource', (isViewer) => done(isViewer));
  });
}), (req, res) => {
  res.send('Custom permission check granted');
});
```

---

## customEnforcerMiddleware(fn, options)

Dynamic permission check where permission string is generated from request.

**Syntax:**
```javascript
app.get('/secure/:permission', keycloak.customEnforcerMiddleware(fn, options), handler);
```

### Parameters

#### `fn` (function(req, res) => string) - Required

Returns permission/resource string to enforce.

#### `options` (Object) - Optional

Same as `enforcerMiddleware` options.

### Returns

Express middleware function.

### Behavior

- Calls `fn(req, res)`.
- Executes `this.keycloak.enforcer(protectionString, options)`.

### Example

```javascript
app.get('/urlPermission/:permission', keycloak.customEnforcerMiddleware((req) => {
  return req.params.permission;
}), (req, res) => {
  res.send(`Permission granted for ${req.params.permission}`);
});
```

## Keycloak Configuration Requirements

For these middleware methods, the Keycloak client should be configured with:

- Authorization Enabled = ON
- Policy Enforcement Mode = Enforcing
- Add permissions to access token = ON (recommended when using token mode)

And corresponding resources/policies/permissions must exist in the realm.
