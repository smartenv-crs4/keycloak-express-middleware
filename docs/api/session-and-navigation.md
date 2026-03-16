# Session and Navigation API

Login/logout flow helpers and user account console redirection.

**Namespace:** instance methods on `keycloakAdapter`

## Table of Contents

- [loginMiddleware(redirectTo)](#loginmiddlewareredirectto)
- [logoutMiddleware(redirectTo)](#logoutmiddlewareredirectto)
- [login(req, res, redirectTo)](#loginreq-res-redirectto)
- [logout(req, res, redirectTo)](#logoutreq-res-redirectto)
- [redirectToUserAccountConsole(res)](#redirecttouseraccountconsoleres)

---

## loginMiddleware(redirectTo)

Force authentication, then redirect to a target route.

### Parameters

- `redirectTo` (string) - Required

### Returns

Express middleware chain.

### Example

```javascript
app.get('/signIn', keycloak.loginMiddleware('/home'), (req, res) => {
  // Not reached: middleware handles response
});
```

---

## logoutMiddleware(redirectTo)

Destroy local session and redirect through Keycloak logout URL.

### Parameters

- `redirectTo` (string) - Required

### Returns

Express middleware function.

### Behavior

- If `id_token` exists: builds Keycloak logout URL, destroys session, redirects.
- If token is missing: redirects directly to `redirectTo`.

### Example

```javascript
app.get('/signOut', keycloak.logoutMiddleware('http://localhost:3001/home'), (req, res) => {
  // Not reached: middleware handles response
});
```

---

## login(req, res, redirectTo)

Imperative (non-middleware) login helper called inside route handler.

### Parameters

- `req` (Express Request) - Required
- `res` (Express Response) - Required
- `redirectTo` (string) - Required

### Returns

`void`

### Example

```javascript
app.get('/login', (req, res) => {
  keycloak.login(req, res, '/home');
});
```

---

## logout(req, res, redirectTo)

Imperative (non-middleware) logout helper called inside route handler.

### Parameters

- `req` (Express Request) - Required
- `res` (Express Response) - Required
- `redirectTo` (string) - Required

### Returns

`void`

### Example

```javascript
app.get('/logout', (req, res) => {
  keycloak.logout(req, res, 'http://localhost:3001/home');
});
```

---

## redirectToUserAccountConsole(res)

Redirect current user to Keycloak account console.

### Parameters

- `res` (Express Response) - Required

### Returns

`void`

### Example

```javascript
app.get('/user/account/console', (req, res) => {
  keycloak.redirectToUserAccountConsole(res);
});
```

## Notes

- For middleware variants (`loginMiddleware`, `logoutMiddleware`), route callback is typically not executed.
- Ensure redirect URLs are configured in Keycloak valid redirect URIs.
- Session destruction depends on Express session middleware being active.
