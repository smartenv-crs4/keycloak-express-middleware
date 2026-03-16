# Token Decode Helpers API

Utility middleware that exposes token role/permission helpers without pre-blocking route access by itself.

**Namespace:** instance methods on `keycloakAdapter`

## Table of Contents

- [encodeTokenRole()](#encodetokenrole)
- [encodeTokenPermission()](#encodetokenpermission)

---

## encodeTokenRole()

Decode the Keycloak token and attach it as `req.encodedTokenRole`.

**Syntax:**
```javascript
app.get('/route', keycloak.encodeTokenRole(), handler);
```

### Parameters

None.

### Returns

Express middleware function.

### Behavior

Internally wraps `keycloak.protect()` and stores decoded token helper on request:

- `req.encodedTokenRole.hasRole(role)`
- `req.encodedTokenRole.hasRealmRole(role)`
- `req.encodedTokenRole.hasResourceRole(role, clientId)`

### Example

```javascript
app.get('/encodeToken', keycloak.encodeTokenRole(), (req, res) => {
  if (req.encodedTokenRole.hasRole('realm:admin')) {
    return res.send('Realm admin user');
  }
  res.send('Regular user');
});
```

---

## encodeTokenPermission()

Attach `req.encodedTokenPermission` helper for manual permission checks.

**Syntax:**
```javascript
app.get('/route', keycloak.encodeTokenPermission(), handler);
```

### Parameters

None.

### Returns

Express middleware function.

### Behavior

Adds:

- `req.encodedTokenPermission.hasPermission(permission, callback)`

`hasPermission` checks permission through the internal enforcer flow and returns boolean via callback.

### Example

```javascript
app.get('/encodeTokenPermission', keycloak.encodeTokenPermission(), (req, res) => {
  req.encodedTokenPermission.hasPermission('ui-admin-resource', (allowed) => {
    if (!allowed) return res.status(403).send('Access Denied');
    res.send('Authorized by permission');
  });
});
```

## When to Use These Helpers

Use decode helpers when you want:

- custom conditional rendering based on role/permission
- manual branching logic in route handlers
- mixed behavior instead of strict allow/deny middleware at entry point
