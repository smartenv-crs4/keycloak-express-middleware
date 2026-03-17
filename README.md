# Keycloak Express Middleware for Node.js (Express)
An adapter API to integrate **Node.js Express** applications with **Keycloak** for authentication and authorization using **OpenID Connect (OIDC)**.
This middleware provides route protection, token validation, and user role management. It is ideal for securing RESTful services, microservices, Express-based backends, and JavaScript frontends.
It is based on **'keycloak-connect'** and **'express-session'**.

## Menu

- [Features](#features)
- [Architecture Evolution Starting from v4.0.0](#architecture-evolution-starting-from-v400)
- [Migration Guide: From Old to New Version](#migration-guide-from-old-to-new-version)
- [Installation](#installation)
- [Get Keycloak Configuration](#get-keycloak-configuration)
- [Authorization and Login Models (Introduction)](#authorization-and-login-models-introduction)
    - [protect vs enforcer](#protect-vs-enforcer-when-to-use-each)
    - [login vs loginPKCE vs loginWithCredentials](#login-vs-loginpkce-vs-loginwithcredentials-when-to-use-each)
- [Full Usage Example](#full-usage-example)
- [API Documentation](#api-documentation)
    - [API - Constructor](#api---constructor)
    - [API - underKeycloakProtection (deprecated)](#api---underkeycloakprotection-deprecated)
    - [API - protectMiddleware](#api---protectmiddlewareconditions)
    - [API - customProtectMiddleware](#api---customprotectmiddlewarecustomfunction)
    - [API - enforcerMiddleware](#api---enforcermiddlewareconditions-options)
    - [API - customEnforcerMiddleware](#api---customenforcermiddlewarecustomfunction-options)
    - [API - encodeTokenRole](#api---encodetokenrole)
    - [API - encodeTokenPermission](#api---encodetokenpermission)
    - [API - loginMiddleware](#api---loginmiddlewareredirectto)
    - [API - logoutMiddleware](#api---logoutmiddlewareredirectto)
    - [API - login](#api---loginreq-res-redirectto)
    - [API - logout](#api---logoutreq-res-redirectto)
    - [API - generateAuthorizationUrl](#api---generateauthorizationurloptions)
    - [API - loginWithCredentials](#api---loginwithcredentialscredentials)
    - [API - loginPKCE](#api---loginpkcecredentials)
    - [API - redirectToUserAccountConsole](#api---redirecttouseraccountconsoleres)
- [Handling Unauthorized Access (401/403) Gracefully](#handling-unauthorized-access-401403-gracefully)
- [Testing Documentation](#testing-documentation)
- [License](#license)
- [Contributions](#contributions)
- [Maintainer](#maintainer)


---
## Features
- OIDC-based authentication with Keycloak
- Access token validation (JWT)
- Route protection via role-based access control
- Automatic token refresh (optional)
- Configurable Keycloak client and realm settings
- User info extraction from token
- CORS support and integration with frontend apps (SPA or mobile)
---
## Architecture Evolution Starting from v4.0.0
Version 4 introduced a substantial architecture evolution.
It now embraces an object-oriented paradigm, which means each instance of the middleware is self-contained and independent. 
Concretely, you can instantiate the library multiple times within the same application—each time pointing to a different client in Keycloak 
and the instances will not share internal connections or state across modules. 
This is a major shift from the previous version (up to 3.0.9), where the library maintained a single shared 
connection and did not support using distinct Keycloak clients simultaneously within the same 
application scope.  By moving to this new ***one instance = one client*** model, you gain the flexibility to support scenarios such as:
 - a single Express application acting as multiple Keycloak clients, each with different realms, client IDs, or roles,
 - isolating middleware logic per client without risking cross-contamination of sessions or grants,
 - simplifying multi-tenancy or microservice architectures where different parts of an app authenticate against different Keycloak clients.
 
**To summarize:** the new version (4.0.0+) enables multi-client usage within the same app by turning the middleware into configurable,
independent object instances, something that the earlier version did not support.

### Migration Guide: From Old to New Version

Old Version (pre-object-oriented)
```js
// OLD VERSION UP TO 3.0.9
const express = require('express');
const keycloakAdapter = require('keycloak-express-middleware');

const app = express();
await keycloakAdapter.configure(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
    "resource": "keycloakClientName",
        "credentials": {
            "secret": "aaaaaaaaaa"
        },
        "confidential-port": 0
    },
    {
        session:{
            secret: 'mySecretForSession',
        }
    });

// Example of protection with keycloakAdapter.protectMiddleware middleware
// with a static client role validation string
// Access is allowed only for authenticated admin users
app.get('/privateStaticClientRole', keycloakAdapter.protectMiddleware("admin"), (req, res) => {
    // "Your Custom Code"
    res.send("You are an admin.");
});
```

New Version (Object-Oriented Design) - Version 4.0.0+

```js
// NEW VERSION STARTING FROM 4.0.0
const express = require('express');
const keycloakAdapter = require('keycloak-express-middleware');

const app = express();

// Create independent Keycloak clients
const keycloakA = new keycloakAdapter(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
    "resource": "keycloakClientName_A",
        "credentials": {
            "secret": "aaaaaaaaaa"
        },
        "confidential-port": 0
    },
    {
        session:{
            secret: 'mySecretForSession',
        }
    });

const keycloakB = new keycloakAdapter(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
    "resource": "keycloakClientName_B",
        "credentials": {
            "secret": "aaaaaaaaaa"
        },
        "confidential-port": 0
    },
    {
        session:{
            secret: 'mySecretForSession',
        }
    });



// Example protected routes
app.get('/clientA/secure', keycloakA.protectMiddleware(), (req, res) => {
    res.send('Protected route for Client A');
});

app.get('/clientB/secure', keycloakB.protectMiddleware(), (req, res) => {
    res.send('Protected route for Client B');
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---
## Installation
```bash
npm install keycloak-express-middleware
```
Or, if using Yarn:
```bash
yarn add keycloak-express-middleware
```

---
## Get Keycloak Configuration
Copy or download your client configuration `keycloak.json` from the Keycloak admin page:
the Keycloak Admin Console → clients (left sidebar) → choose your client → Installation → Format Option → Keycloak OIDC JSON → Download
```json
{
  "realm": "your-realm",
  "auth-server-url": "https://your-keycloak-domain/auth",
  "ssl-required": "external",
  "resource": "your-client-id",
  "credentials": {
    "secret": "your-client-secret"
  },
  "confidential-port": 0
}
```

---
## Full Usage Example
```js
const express = require('express');
// CommonJS - Default import
const keycloakAdapter = require('keycloak-express-middleware');

// ES6 - Named import (recommended for clarity)
// import { keycloackAdapter as keycloakAdapter } from 'keycloak-express-middleware';

// ES6 - Default import
// import keycloakAdapter from 'keycloak-express-middleware';

const app = express();


// Configure and Initialize Keycloak adapter
const keycloakInstance = new keycloakAdapter(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
    "resource": "keycloakClientName",
        "credentials": {
            "secret": "aaaaaaaaaa"
        },
        "confidential-port": 0
    },
    {
        session:{
            secret: 'mySecretForSession',
        }
    });

// -------------- Public route  -----------------------
app.get('/', (req, res) => {
  res.send('Public route: no authentication required');
});


/* ############## Protected routes (any authenticated user) ###########  */

// Example of login with keycloakInstance.login function
// After login redirect to "/home" 
app.get('/signIn', (req, res) => {
    console.log("Your Custom Code");
    keycloakInstance.login(req,res,"/home")

});

// Example of login with keycloakInstance.loginMiddleware middleware
// After login redirect to "/home" 
app.get('/loginMiddleware', keycloakInstance.loginMiddleware("/home") ,(req, res) => {
    // Response handled by middleware, this section will never be reached.
});

// Example of logout with keycloakInstance.logout function
// After login redirect to "http://localhost:3001/home" 
app.get('/logout', (req, res) => {
    console.log("Your Custom Code");
    keycloakInstance.logout(req,res,"http://localhost:3001/home");
});

// Example of logout with keycloakInstance.logoutMiddleware middleware
// After login redirect to "http://localhost:3001/home"
app.get('/logoutMiddle', keycloakInstance.logoutMiddleware("http://redirectUrl"), (req, res) => {
    // Response handled by middleware, this section will never be reached.
});


// Example of protection with keycloakInstance.protectMiddleware middleware
// Access is allowed only for authenticated users
app.get('/private', keycloakInstance.protectMiddleware(), (req, res) => {
    console.log("Your Custom Code");
    console.log( req.session);
    res.redirect('/auth');
});

// Example of protection with keycloakInstance.protectMiddleware middleware
// with a static client role validation string
// Access is allowed only for authenticated admin users
app.get('/privateStaticClientRole', keycloakInstance.protectMiddleware("admin"), (req, res) => {
    // "Your Custom Code"
    res.send("You are an admin.");
});

// Example of protection with keycloakInstance.protectMiddleware middleware
// with a static realm role validation string
// Access is allowed only for authenticated realm admin users
app.get('/privateStaticRealmRole', keycloakInstance.protectMiddleware("realm:admin"), (req, res) => {
    // "Your Custom Code"
    res.send("You are a realm admin.");
});

// Example of protection with keycloakInstance.protectMiddleware middleware
// with a static other client role validation string
// Access is allowed only for authenticated otherClient admin users
app.get('/privateStaticRealmRole', keycloakInstance.protectMiddleware("otherClient:admin"), (req, res) => {
    // "Your Custom Code"
    res.send("You are an admin of otherClient.");
});

// Example of protection with keycloakInstance.protectMiddleware middleware
// with a control function tmpFunction
// Access is allowed only for authenticated admin users
let tmpFunction=function (token, req) {
    return token.hasRole('admin');
}
app.get('/isAdmin', keycloakInstance.protectMiddleware(tmpFunction), (req, res) => {
    // "Your Custom Code"
    res.send("You are an admin (verified by tmpFunction).");
});


// Example of protection with keycloakInstance.customProtectMiddleware middleware
// with a control function tmpFunctionString
// Access is allowed only for authenticated users with role defined by tmpFunctionString
let tmpFunctionString=function (req,res) {
    let id=req.params.id
    // Control String by url param Id 
    return (`${id}`);
}
app.get('/:id/isAdmin', keycloakInstance.customProtectMiddleware(tmpFunctionString), (req, res) => {
    // "Your Custom Code"
    res.send("You are an admin (verified by tmpFunctionString).");
});


// Example of protection with keycloakInstance.encodeTokenRole middleware
// Encode the token and add it to req.encodedTokenRole
// Use req.encodedTokenRole.hasRole("role") to check whether the token has that role or not
app.get('/encodeToken', keycloakInstance.encodeTokenRole(), (req, res) => {
    if(req.encodedTokenRole.hasRole('realm:admin'))
        res.send("You are a realm admin");
    else
        res.send("You are not a realm admin");

});


// #####################################################################################
// #   This section provides examples of how to protect resources based on permissions #
// #   rather than roles.                                                              #                                
// #####################################################################################


// Example of protection with keycloakInstance.enforcerMiddleware middleware
// with a static control string
// Access is allowed only for users with 'ui-admin-resource' permission defined 
// in keycloak
app.get('/adminResource', keycloakInstance.enforcerMiddleware('ui-admin-resource'), (req, res) => {
    // If this section is reached, the user has the required privileges; 
    // otherwise, the middleware responds with a 403 Access Denied.
    res.send('You are an authorized ui-admin-resource User');
});

// Example of protection with keycloakInstance.enforcerMiddleware middleware
// with a control function tmpFunctionEnforceValidation
// Access is allowed only for users with 'ui-admin-resource' or
// ui-viewer-resource permission defined in keycloak
let tmpFunctionEnforceValidation=function (token,req,callback) {
    // Check permission using token.hasPermission, which performs the verification
    // and responds with a callback that returns true if the permission is valid, 
    // and false otherwise.
    if(token.hasPermission('ui-admin-resource',function(permission){
        if(permission) callback(true);
        else if(token.hasPermission('ui-viewer-resource',function(permission){
            if(permission) callback(true);
            else callback(false);
        }));
    }));
}
app.get('/adminOrViewerResource', keycloakInstance.enforcerMiddleware(tmpFunctionEnforceValidation), (req, res) => {
    // If this section is reached, the user has the required privileges 
    // driven by tmpFunctionEnforceValidation; otherwise, the middleware responds
    // with a 403 Access Denied.
    res.send('You are an authorized User');
});


// Example of protection with keycloakInstance.customEnforcerMiddleware middleware
// with a control function tmpFunctionEnforce that define the control string
// Access is allowed only for users with a url params ':permission' permission defined 
// in keycloak
let tmpFunctionEnforce=function (req,res) {
    // Permission that depends on a URL parameter.
    return(req.params.permission);
}
app.get('/urlParameterPermission/:permission', keycloakInstance.customEnforcerMiddleware(tmpFunctionEnforce), (req, res) => {
    res.send(`You are an authorized User with ${req.params.permission} permission`);
});

// Example of protection with keycloakInstance.encodeTokenPermission middleware
// Encode the token permission and add it to req.encodedTokenPermission
// Use req.encodedTokenPermission.hasPermission("permission") to check whether
// the token has that permission or not
app.get('/encodeTokenPermission', keycloakInstance.encodeTokenPermission(), (req, res) => {
    // Check permission using token.hasPermission, which performs the verification
    // and responds with a callback that returns true if the permission is valid, 
    // and false otherwise.
    req.encodedTokenPermission.hasPermission('ui-admin-resource', function(permission){
        if(permission)
            res.send('You are an authorized User by ui-admin-resource permission');
        else res.status(403).send("access Denied");
    });
});



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```
---

## Authorization and Login Models (Introduction)

This package exposes two different authorization families and multiple login/token flows.
Understanding this distinction before reading the single-method API reference helps you select the correct integration strategy.

### protect vs enforcer (when to use each)

Both protect routes, but they represent different security models.

| Aspect | `protectMiddleware` | `enforcerMiddleware` |
|---|---|---|
| Core model | Role-based access control (RBAC) | Permission/policy-based access control (Authorization Services, UMA) |
| Input | Roles (`admin`, `realm:admin`, `client:role`) | Resource/scope permissions (`invoice:read`, `report-resource:view`) |
| Decision source | Token roles | Keycloak Authorization Services policies |
| Setup complexity | Low | Medium/High |
| Typical usage | Standard protected areas, role-gated endpoints | Fine-grained resource protection, ownership/scoped access |

Use `protectMiddleware` when:

- Your access rules are role-centric.
- You need quick, explicit route-level authorization with minimal Keycloak policy setup.

Use `enforcerMiddleware` when:

- Access depends on resource and scope permissions.
- You want policies managed in Keycloak and evaluated centrally.

Practical examples:

- `protectMiddleware('admin')`: endpoint reserved to users with admin role.
- `enforcerMiddleware('invoice:approve')`: endpoint reserved to users with explicit permission to approve invoices.

### login vs loginPKCE vs loginWithCredentials (when to use each)

These APIs belong to different layers of the authentication/token lifecycle.

| Aspect | `login(req, res, redirectTo)` | `loginPKCE(credentials)` | `loginWithCredentials(credentials)` |
|---|---|---|---|
| Main purpose | Trigger interactive browser login via middleware | Exchange authorization code + PKCE verifier for tokens | Generic OAuth2 token endpoint call |
| Typical phase | Login entry route in Express app | Callback route after authorization redirect | Programmatic token operations |
| Input style | Express `req`/`res` + redirect target | `code`, `redirect_uri`, `code_verifier` (+ aliases) | `grant_type` + fields required by selected grant |
| Output | Redirect side effect | Token payload | Token payload |
| Best fit | Session/server-rendered flow | PKCE-based web/mobile/SPA/BFF flows | Low-level grant handling (refresh, client credentials, etc.) |

Use `login(...)` when:

- You want middleware-managed interactive login with redirect.
- You are coding route-level navigation flow in Express.

Use `loginPKCE(...)` when:

- You already initiated PKCE with `generateAuthorizationUrl(...)`.
- You are handling callback exchange securely using stored `codeVerifier`.

Use `loginWithCredentials(...)` when:

- You need direct token endpoint operations (e.g., refresh token, client credentials, custom grant handling).
- You need a reusable low-level method for different OAuth2 grant payloads.

Recommended PKCE sequence:

1. Start flow with `generateAuthorizationUrl(...)` and persist `state` + `codeVerifier` server-side.
2. Redirect user to generated authorization URL.
3. Receive authorization `code` in callback.
4. Exchange using `loginPKCE(...)`.
5. Use/persist tokens according to your session/token strategy.

---
## API Documentation

This section provides a complete reference for all public APIs exposed by the middleware class.

Reference conventions used below:

- `Required`: whether the field must be provided by the caller.
- `Middleware return`: function consumable by Express route registration.
- Error sections include only explicit runtime errors thrown by the method itself.

### API - Constructor

**Signature**

```js
new keycloakAdapter(app, keycloakConfig, keycloakOptions = {})
```

Creates one isolated adapter instance bound to one Keycloak client.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `app` | `Object` | Yes | Express app or router instance. |
| `keycloakConfig` | `Object` | Yes | Keycloak client configuration (`realm`, `auth-server-url`, `resource`, `credentials`, etc.). |
| `keycloakOptions` | `Object` | No | Advanced adapter options (session and Keycloak behavior options). |

**Supported `keycloakOptions` fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `session` | `Object` | No | Enables internal session initialization with `express-session` + MemoryStore. |
| `session.secret` | `string` | No | Session secret. |
| `session.resave` | `boolean` | No | Express session `resave` option. |
| `session.saveUninitialized` | `boolean` | No | Express session `saveUninitialized` option. |
| `realmName` | `string` | No | Optional realm override. |
| `clientId` | `string` | No | Optional client ID override. |
| `clientSecret` | `string` | No | Optional client secret override. |
| `scope`, `idpHint`, `cookies`, `realmUrl` | `string/object` | No | Forwarded to Keycloak adapter behavior. |

**Returns**

- Configured middleware instance.

### API - underKeycloakProtection (deprecated)

**Signature**

```js
underKeycloakProtection(callback)
```

Legacy helper retained for backward compatibility. Executes `callback` when the middleware is ready.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `callback` | `Function` | Yes | Function that declares protected routes. |

**Returns**

- `void`.

**Example**

```js
keycloakInstance.underKeycloakProtection(() => {
    app.get('/private', keycloakInstance.protectMiddleware(), handler);
});
```

### API - protectMiddleware(conditions)

**Signature**

```js
protectMiddleware(conditions)
```

Protects routes through authentication and optional role-based authorization.

**What this API is for**

- Use this middleware when access rules are based on roles and you want authorization directly on route declaration.
- It is the default choice for RBAC scenarios such as admin/user/editor segmentation.

**When to prefer it**

- You already model permissions as roles in Keycloak.
- You do not need policy-based, resource-level authorization.
- You want a simple, readable route contract (role required is visible in code).

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `conditions` | `undefined \| null \| string \| string[] \| Function` | No | Access condition: authentication only, role expression(s), or custom predicate `(token, req) => boolean`. |

**Role expression formats**

- `'admin'`: role in configured client.
- `'realm:admin'`: realm role.
- `'clientid:role'`: role in another client.

**Returns**

- Middleware return.

**Detailed behavior**

- With no `conditions`, access is granted to any authenticated user.
- With `string` or `string[]`, access is granted if the token has at least one matching role.
- With a predicate function, your function decides access synchronously using token/request context.
- On deny, Keycloak returns unauthorized/forbidden response according to adapter configuration.

**Internal flow in practice**

1. Middleware checks whether a valid Keycloak authentication context exists.
2. If no role constraint is provided, authentication is sufficient.
3. If role constraints are present, token roles are evaluated.
4. If conditions fail, request is terminated with auth error handling.
5. If conditions pass, control goes to next handler.

**Notes**

- Token claims are available at `req.kauth.grant.access_token.content` in downstream handlers.
- This API is role-oriented, not permission-oriented.

**Example**

```js
app.get('/admin', keycloakInstance.protectMiddleware('admin'), (req, res) => {
    const token = req.kauth.grant.access_token.content;
    res.json({ user: token.preferred_username, scope: token.scope });
});
```

### API - customProtectMiddleware(customFunction)

**Signature**

```js
customProtectMiddleware(customFunction)
```

Builds role expressions dynamically from request context.

**What this API is for**

- Use this middleware when the required role is request-dependent (for example URL params, tenant id, or feature partition).
- It avoids hardcoding one static role for every route variant.

**When to prefer it**

- One route family maps to many role names.
- The role expression can be derived synchronously from request data.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `customFunction` | `Function` | Yes | `(req, res) => string`, returns role expression passed to Keycloak protect. |

**Returns**

- Middleware return.

**Example**

```js
app.get('/tenant/:role', keycloakInstance.customProtectMiddleware((req) => {
    return req.params.role;
}), handler);
```

### API - enforcerMiddleware(conditions, options)

**Signature**

```js
enforcerMiddleware(conditions, options)
```

Performs permission checks via Keycloak Authorization Services (UMA 2.0).

**What this API is for**

- Use this middleware for fine-grained authorization where roles are not enough.
- It is designed for resource/scope decisions evaluated by Keycloak policies.

**When to prefer it**

- Access depends on resource ownership, scopes, or dynamic claims.
- You want authorization logic centralized in Keycloak Authorization Services.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `conditions` | `string \| string[] \| Function` | Yes | Static permission expression(s) or custom async evaluator `(token, req, callback)` where callback receives boolean. |
| `options` | `Object` | No | Forwarded enforcer options. |

**Supported `options` fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `response_mode` | `'permissions' \| 'token'` | No | Determines permission payload mode. |
| `claims` | `Object` | No | Additional claims for policy evaluation. |
| `resource_server_id` | `string` | No | Resource server client ID. |

**Returns**

- Middleware return.

**Detailed behavior**

- Evaluates permissions through Keycloak Authorization Services policies.
- With `response_mode: 'permissions'`, granted permissions are exposed in `req.permissions`.
- With `response_mode: 'token'`, Keycloak issues token with authorization details in token claims.
- With function conditions, callback decides allow/deny after async permission checks.

**Internal flow in practice**

1. Middleware resolves static permission expression(s) or executes custom async evaluator.
2. Keycloak evaluates policies against token + resource context.
3. Result is surfaced as allowed/denied (and optionally permissions payload/token mode).
4. Request continues only if policy evaluation grants access.

**Keycloak prerequisites**

- Client must have Authorization enabled.
- Policy Enforcement Mode must be configured.
- Resources, policies, and permissions must be defined in Keycloak.

**Example**

```js
app.get('/report', keycloakInstance.enforcerMiddleware('report-resource:view'), handler);
```

### API - customEnforcerMiddleware(customFunction, options)

**Signature**

```js
customEnforcerMiddleware(customFunction, options)
```

Dynamic permission-check middleware that derives permission expressions from request context.

**What this API is for**

- Use this middleware when permission string must be generated per request (for example `resource:${id}:read`).
- It combines dynamic request context with Keycloak Authorization Services evaluation.

**When to prefer it**

- Permission names are not static.
- Resource identity comes from path/query/header data.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `customFunction` | `Function` | Yes | `(req, res) => string`, returns permission expression for enforcer. |
| `options` | `Object` | No | Same options accepted by `enforcerMiddleware`. |

**Returns**

- Middleware return.

**Example**

```js
app.get('/resource/:permission', keycloakInstance.customEnforcerMiddleware((req) => {
    return req.params.permission;
}), handler);
```

### API - encodeTokenRole

**Signature**

```js
encodeTokenRole()
```

Exposes decoded token-role helpers on the request object.

**What this API is for**

- Use this middleware when you want to read role information inside business logic without enforcing a role gate at middleware declaration time.
- Useful for adaptive responses (for example enhanced payload for admins).

**Returns**

- Middleware return.

**Request augmentation**

- Adds `req.encodedTokenRole`.
- Common methods:
- `hasRole('admin')`
- `hasRole('realm:admin')`
- `hasRole('clientid:editor')`
- `hasResourceRole('editor', 'clientid')`

**Example**

```js
app.get('/profile', keycloakInstance.encodeTokenRole(), (req, res) => {
    const isRealmAdmin = req.encodedTokenRole.hasRole('realm:admin');
    res.json({ isRealmAdmin });
});
```

### API - encodeTokenPermission

**Signature**

```js
encodeTokenPermission()
```

Adds permission-check helper utilities to the request object.

**What this API is for**

- Use this middleware when you need conditional permission checks inside handler code rather than strict upfront route blocking.
- Useful when a single endpoint supports multiple authorization branches.

**Returns**

- Middleware return.

**Request augmentation**

- Adds `req.encodedTokenPermission.hasPermission(permission, callback)`.

**Helper parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `permission` | `string` | Yes | Permission expression to evaluate. |
| `callback` | `Function` | Yes | Callback receiving `true` when allowed, `false` otherwise. |

**Example**

```js
app.get('/can-read', keycloakInstance.encodeTokenPermission(), (req, res) => {
    req.encodedTokenPermission.hasPermission('doc:read', (ok) => {
        if (ok) return res.send('Allowed');
        res.status(403).send('Denied');
    });
});
```

### API - loginMiddleware(redirectTo)

**Signature**

```js
loginMiddleware(redirectTo)
```

Forces authentication and redirects authenticated users to destination.

**What this API is for**

- Use this middleware for routes that should behave as login entry points.
- Typical example: `/signin` route that always triggers authentication then navigates user to app page.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `redirectTo` | `string` | Yes | Post-login redirect URL. |

**Returns**

- Middleware chain (`protect` + redirect handler).

**Operational note**

- Route callback after this middleware is typically not reached.

### API - logoutMiddleware(redirectTo)

**Signature**

```js
logoutMiddleware(redirectTo)
```

Destroys local session and redirects through Keycloak logout endpoint when token is present.

**What this API is for**

- Use this middleware for clean logout endpoints that invalidate local session and, when possible, terminate Keycloak session.
- Keeps logout behavior consistent and centralized in one middleware.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `redirectTo` | `string` | Yes | Post-logout redirect URL. |

**Returns**

- Middleware return.

**Behavior**

- If `id_token` exists, builds Keycloak logout URL and destroys session before redirect.
- If token is missing, redirects directly to `redirectTo`.

### API - login(req, res, redirectTo)

**Signature**

```js
login(req, res, redirectTo)
```

Imperative login helper intended for use inside route handlers.

**What this API is for**

- Use this function when login should happen conditionally inside handler logic.
- Typical example: login only after validating custom preconditions.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `req` | `Object` | Yes | Express request. |
| `res` | `Object` | Yes | Express response. |
| `redirectTo` | `string` | Yes | Redirect destination after successful authentication. |

**Returns**

- `void`.

**Detailed behavior**

- Calls Keycloak protect flow immediately.
- If authenticated, performs `res.redirect(redirectTo)`.
- If not authenticated, user is redirected to Keycloak login.
- Designed for imperative use inside a route where you may execute custom logic before triggering login.

### API - logout(req, res, redirectTo)

**Signature**

```js
logout(req, res, redirectTo)
```

Imperative logout helper intended for use inside route handlers.

**What this API is for**

- Use this function when logout should be triggered after custom handler logic (audit logging, cleanup, conditional branching).

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `req` | `Object` | Yes | Express request. |
| `res` | `Object` | Yes | Express response. |
| `redirectTo` | `string` | Yes | Redirect destination after logout. |

**Returns**

- `void`.

### API - generateAuthorizationUrl(options)

**Signature**

```js
generateAuthorizationUrl(options = {})
```

Builds PKCE initialization values and authorization URL.

**What this API is for**

- Use this method to start a modern OAuth2 Authorization Code + PKCE flow.
- It creates all artifacts needed to securely initiate login redirect.

**Security relevance**

- `state` protects against CSRF and response-mixup style attacks.
- `codeVerifier` is the secret proof used in callback token exchange.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `options.redirect_uri` | `string` | Yes | Callback URI used by Keycloak after login. |
| `options.redirectUri` | `string` | No | CamelCase alias of `redirect_uri`. |
| `options.scope` | `string` | No | Requested scopes. Default: `openid profile email`. |
| `options.state` | `string` | No | Custom state value; auto-generated when omitted. |

**Returns**

| Field | Type | Description |
|---|---|---|
| `authUrl` | `string` | Fully formed authorization URL. |
| `state` | `string` | CSRF state value to store server-side. |
| `codeVerifier` | `string` | PKCE verifier to store server-side. |

**Errors**

- Throws `Error` when middleware initialization data is missing.
- Throws `Error` when `redirect_uri`/`redirectUri` is missing.

**Example**

```js
const pkce = keycloakInstance.generateAuthorizationUrl({
    redirect_uri: 'https://app.example.com/auth/callback'
});
req.session.pkce_state = pkce.state;
req.session.pkce_verifier = pkce.codeVerifier;
res.redirect(pkce.authUrl);
```

### API - loginWithCredentials(credentials)

**Signature**

```js
async loginWithCredentials(credentials = {})
```

Generic OAuth2 token endpoint helper supporting multiple grant types.

**What this API is for**

- Use this method when your application needs direct programmatic token endpoint access.
- It is the low-level token exchange utility used by higher-level flows as well.

**Typical grants handled**

- `password`
- `client_credentials`
- `authorization_code`
- `refresh_token`

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `credentials.grant_type` | `string` | Yes | OAuth2 grant type. |
| `credentials.username` | `string` | No | Username for password grant. |
| `credentials.password` | `string` | No | Password for password grant. |
| `credentials.client_id` | `string` | No | Client ID override. |
| `credentials.client_secret` | `string` | No | Client secret override. |
| `credentials.refresh_token` | `string` | No | Refresh token for refresh grant. |
| `credentials.code` | `string` | No | Authorization code for authorization-code grant. |
| `credentials.redirect_uri` | `string` | No | Redirect URI for authorization-code grant. |
| `credentials.scope` | `string` | No | Requested scopes. |

**Returns**

- `Promise<Object>`: token payload from Keycloak token endpoint.

**Errors**

- Throws `Error` when middleware initialization data is missing.
- Throws `Error` when token endpoint responds with non-success status.

### API - loginPKCE(credentials)

**Signature**

```js
async loginPKCE(credentials = {})
```

Performs authorization-code + PKCE verifier exchange.

**What this API is for**

- Use this method in callback endpoints after Keycloak redirects user back with authorization code.
- It specializes token exchange for PKCE and validates required PKCE inputs.

**Why it matters**

- PKCE mitigates intercepted authorization code reuse by binding code to `code_verifier`.
- This method encapsulates the correct grant payload shape for PKCE callback stage.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `credentials.code` | `string` | Yes | Authorization code returned by Keycloak. |
| `credentials.redirect_uri` or `credentials.redirectUri` | `string` | Yes | Callback URI used in authorization step. |
| `credentials.code_verifier` or `credentials.codeVerifier` | `string` | Yes | PKCE verifier from server session. |
| `credentials.client_id` or `credentials.clientId` | `string` | No | Client ID override. |
| `credentials.client_secret` or `credentials.clientSecret` | `string` | No | Client secret override. |
| Additional token fields | `string` | No | Forwarded to token request body. |

**Returns**

- `Promise<Object>`: token payload.

**Errors**

- Throws `Error` when `code` is missing.
- Throws `Error` when `redirect_uri`/`redirectUri` is missing.
- Throws `Error` when `code_verifier`/`codeVerifier` is missing.
- Propagates token endpoint errors from `loginWithCredentials`.

**Example**

```js
const tokens = await keycloakInstance.loginPKCE({
    code: req.query.code,
    redirect_uri: 'https://app.example.com/auth/callback',
    code_verifier: req.session.pkce_verifier
});
```

### API - redirectToUserAccountConsole(res)

**Signature**

```js
redirectToUserAccountConsole(res)
```

Redirects user to the Keycloak account console endpoint for the configured realm.

**What this API is for**

- Use this helper to provide a direct “Manage Account” navigation endpoint from your app.
- It delegates profile/security management to Keycloak account console UI.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `res` | `Object` | Yes | Express response. |

**Returns**

- `void`.

---
## Handling Unauthorized Access (401/403) Gracefully

When a user tries to access a protected resource without the proper roles, the `keycloak-express-middleware` may respond with a plain `401` or `403` message containing `access_denied`.  
While technically correct, this behavior results in a **blank browser page** showing only that message.
To improve user experience, you can easily intercept these responses and display a custom HTML page or redirect users 
elsewhere using the [`responseinterceptor`](https://www.npmjs.com/package/responseinterceptor) middleware.
This allows developers to present a more user-friendly "Access Denied" page or redirect unauthorized users to 
a login or error page.

> 🛈 Note: In a secure application, users should normally not reach protected routes without authentication.  
> However, for simplicity or flexibility during development, this interception approach can be convenient.

### Example 1 - Custom Access Denied Page

```js
const responseinterceptor = require('responseinterceptor');
const keycloakAdapter = require('keycloak-express-middleware');

const app = express();
const keycloakInstance = new keycloakAdapter(app, keycloakConfig, keycloakOptions);


function tmpInterceptor(req, respond) {
    /**
     * Gracefully handles unauthorized access (401/403).
     *
     * This interceptor is executed when a protected route returns
     * a forbidden status code. Instead of letting the browser show
     * a blank page with the text "access_denied", it renders a
     * user-friendly "access-denied" view.
     *
     * How it works:
     * - Uses `req.app.render()` to generate HTML from the EJS template
     *   without sending it directly to the client.
     * - If rendering succeeds, the generated HTML is passed to `respond()`,
     *   which replaces the original 403 response body with our custom page.
     * - If rendering fails, a fallback HTML message is provided.
     */

    req.app.render('access-denied', {}, (err, html) => {
        if (!err) {
            // Successfully rendered the template → return the generated HTML
            respond(200, html);
        } else {
            // Fallback: template error → send a simple HTML message instead
            respond(
                200,
                '<h1>Access Denied</h1><p>You are not authorized to view this page.</p>'
            );
        }
    });
}

// Route example showing how to gracefully handle 403 responses produced by Keycloak
//
// If `protectMiddleware('role')` denies access, Keycloak normally returns a 
// plain "access_denied" message on a blank page. 
//
// By placing `interceptByStatusCode(403, tmpInterceptor)` BEFORE the protectMiddleware,
// we intercept the 403 response generated by Keycloak and replace it with a
// custom HTML page (e.g. an EJS template) instead of the default blank output.

app.get(
    '/test403',
    responseinterceptor.interceptByStatusCode(403, tmpInterceptor),
    keycloakInstance.protectMiddleware('role'),
    (req, res) => {
        res.render('welcome');
    }
);
```

### Example 2 - Redirect to a Dedicated Page (Dynamic Redirect)

```js
function tmpInterceptorDinamic(req, respond) {
    /**
     * Dynamic Redirect Interceptor
     *
     * This function decides dynamically where the user should be redirected
     * after a 403 Unauthorized response is intercepted.
     *
     * - `req`     → the original Express request
     * - `respond` → helper function that receives the final redirect route
     *
     * Based on the current request path, we redirect the user to different
     * "access denied" pages.
     */
    switch (req.path) {
        case '/':
            respond('/access-denied');
            break;

        case '/help':
            respond('/access-denied-help');
            break;

        default:
            respond('/access-denied-default');
    }
}

// Dedicated "Access Denied" pages
app.get('/access-denied', (req, res) => {
    res.render('access-denied');
});

app.get('/access-denied-help', (req, res) => {
    res.render('access-denied-help');
});

app.get('/access-denied-default', (req, res) => {
    res.render('access-denied-default');
});

// -----------------------------------------------------------------------
// Example: dynamic redirection after Keycloak denies access (403)
// -----------------------------------------------------------------------
//
// If protectMiddleware('none') triggers a 403 (Keycloak default behavior),
// the `interceptByStatusCodeRedirectTo` middleware intercepts Keycloak’s
// blank "access_denied" page and replaces it with a redirect determined
// by tmpInterceptorDinamic().
//
// This allows:
//
//   ✓ No more blank browser page with "access_denied"
//   ✓ User-friendly redirection to custom EJS pages
//   ✓ Dynamic routing logic based on the original request
//
app.get(
    '/test403redirectDynamic',
    responseinterceptor.interceptByStatusCodeRedirectTo(403, tmpInterceptorDinamic),
    keycloakInstance.protectMiddleware('none'),
    (req, res) => {
        res.render('welcome');
    }
);
```

### Example 3 - Static Redirect to a Route

```js
// If protectMiddleware('role') triggers a 403 (forbidden) and Keycloak returns
// the default blank 403 page, we use interceptByStatusCodeRedirectTo()
// to gracefully handle the unauthorized response.
//
// When a 403 is detected, the interceptor forces an HTTP redirect to the
// custom '/access-denied' route, allowing us to show a friendly UI instead
// of Keycloak’s default error page.
//
// This ensures consistent UX and keeps request flow under our control.
app.get(
    '/test403redirectStatic',
    responseinterceptor.interceptByStatusCodeRedirectTo(403, '/access-denied'),
    keycloakInstance.protectMiddleware('none'),
    (req, res) => {
        res.render('welcome');
    }
);

```

### Summary

| Scenario | Middleware Used | Action |
|-----------|------------------|---------|
| Replace response content | `interceptByStatusCode()` | Renders a custom message or template |
| Redirect dynamically | `interceptByStatusCodeRedirectTo()` + callback | Redirects to a route computed in code |
| Redirect statically | `interceptByStatusCodeRedirectTo()` + string | Redirects to a predefined route |


---


## Testing Documentation

Testing documentation remains in dedicated external pages:

- [Testing Environment and Scripts](docs/testing-environment.md)
- [Testing Guide](docs/testing.md)
- [Test Configuration](docs/test-configuration.md)


## License

This project is licensed under the MIT License.

Copyright (c) 2025 CRS4, aromanino, gporruvecchio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Contributions

Contributions, issues and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

---

## Maintainer

Developed and maintained by [CRS4 Microservice Core Team ([cmc.smartenv@crs4.it](mailto:cmc.smartenv@crs4.it))] - feel free to reach out for questions or suggestions.

Design and development
------
Alessandro Romanino ([a.romanino@gmail.com](mailto:a.romanino@gmail.com))<br>
Guido Porruvecchio ([guido.porruvecchio@gmail.com](mailto:guido.porruvecchio@gmail.com))


