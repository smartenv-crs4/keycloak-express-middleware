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
- [Full Usage Example](#full-usage-example)
- [Authorization Models (Introduction)](#authorization-models-introduction)
    - [protect vs enforcer](#protect-vs-enforcer-when-to-use-each)
- [API Documentation](#api-documentation)
    - [Core Functions](#core-functions)
        - [API - Constructor](#api---constructor)
        - [API - underKeycloakProtection (deprecated)](#api---underkeycloakprotection-deprecated)
    - [Middleware APIs](#middleware-apis)
        - [API - protectMiddleware](#api---protectmiddlewareconditions)
        - [API - customProtectMiddleware](#api---customprotectmiddlewarecustomfunction)
        - [API - enforcerMiddleware](#api---enforcermiddlewareconditions-options)
        - [API - customEnforcerMiddleware](#api---customenforcermiddlewarecustomfunction-options)
        - [API - encodeTokenRole](#api---encodetokenrole)
        - [API - encodeTokenPermission](#api---encodetokenpermission)
        - [API - loginMiddleware](#api---loginmiddlewareredirectto)
        - [API - logoutMiddleware](#api---logoutmiddlewareredirectto)
    - [Imperative and OIDC Functions](#imperative-and-oidc-functions)
        - [login vs loginPKCE vs loginWithCredentials](#login-vs-loginpkce-vs-loginwithcredentials-when-to-use-each)
        - [loginMiddleware vs login](#loginmiddleware-vs-login-same-goal-different-style)
        - [API - login](#api---loginreq-res-redirectto)
        - [API - logout](#api---logoutreq-res-redirectto)
        - [API - generateAuthorizationUrl](#api---generateauthorizationurloptions)
        - [API - loginWithCredentials](#api---loginwithcredentialscredentials)
        - [API - loginPKCE](#api---loginpkcecredentials)
        - [API - redirectToUserAccountConsole](#api---redirecttouseraccountconsoleres)
        - [API - hasScope](#api---hasscopescopeinput-requiredscope)
        - [API - hasScopes](#api---hasscopesscopeinput-requiredscopes-mode)
        - [API - getTokenClaims](#api---gettokenclaimsreq)
        - [API - isAuthenticated](#api---isauthenticatedreq)
        - [API - getScopes](#api---getscopesscopeinputorreq)
        - [API - hasScopeFromRequest](#api---hasscopefromrequestreq-requiredscope)
        - [API - hasScopesFromRequest](#api---hasscopesfromrequestreq-requiredscopes-mode)
        - [API - requireScopes](#api---requirescopesrequiredscopes-mode)
- [Recipes and Patterns](docs/recipes.md)
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
app.get('/privateStaticOtherClientRole', keycloakInstance.protectMiddleware("otherClient:admin"), (req, res) => {
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


// Example of direct token endpoint usage with keycloakInstance.loginWithCredentials
// Useful for server-to-server operations (client credentials flow)
app.get('/service-token', async (req, res) => {
    try {
        const tokenResponse = await keycloakInstance.loginWithCredentials({
            grant_type: 'client_credentials',
            scope: 'openid profile email'
        });

        res.json({
            access_token: tokenResponse.access_token,
            expires_in: tokenResponse.expires_in,
            token_type: tokenResponse.token_type,
            scope: tokenResponse.scope
        });
    } catch (err) {
        res.status(401).json({
            error: 'Token request failed',
            details: err.message
        });
    }
});



// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```
---

## Authorization Models (Introduction)

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

---
## API Documentation

This section provides a complete reference for all public APIs exposed by the middleware class.

Reference conventions used below:

- `Required`: whether the field must be provided by the caller.
- `Middleware return`: function consumable by Express route registration.
- Error sections include only explicit runtime errors thrown by the method itself.

### Core Functions

#### API - Constructor

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

**Practical example - Basic configuration**

```js
const keycloakInstance = new keycloakAdapter(app, keycloakConfig, {
    session: {
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false
    }
});
```

**Example - Multi-tenant setup (multiple Keycloak clients)**

```js
// Tenant A: separate Keycloak client
const keycloakTenantA = new keycloakAdapter(app, {
    realm: 'tenant-a',
    resource: 'tenant-a-client',
    'auth-server-url': 'https://keycloak.example.com/',
    credentials: { secret: process.env.TENANT_A_SECRET }
}, { session: { secret: process.env.SESSION_SECRET } });

// Tenant B: separate Keycloak client
const keycloakTenantB = new keycloakAdapter(app, {
    realm: 'tenant-b',
    resource: 'tenant-b-client',
    'auth-server-url': 'https://keycloak.example.com/',
    credentials: { secret: process.env.TENANT_B_SECRET }
}, { session: { secret: process.env.SESSION_SECRET } });

// Route for Tenant A
app.get('/a/profile', keycloakTenantA.protectMiddleware(), (req, res) => {
    res.json({ tenant: 'A', user: req.kauth.grant.access_token.content.preferred_username });
});

// Route for Tenant B
app.get('/b/profile', keycloakTenantB.protectMiddleware(), (req, res) => {
    res.json({ tenant: 'B', user: req.kauth.grant.access_token.content.preferred_username });
});
```

#### API - underKeycloakProtection (deprecated)

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

### Middleware APIs

#### API - protectMiddleware(conditions)

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

**Using `conditions` as a function**

When `conditions` is a function, the middleware calls it with:

- `token`: decoded Keycloak token helper object.
- `req`: current Express request.

The function must return `true` (allow) or `false` (deny) synchronously.
This mode is useful when role checks must be combined with request-specific data (headers, params, query values, etc.).

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

**Example with `conditions` as function**

```js
app.get('/editor-area', keycloakInstance.protectMiddleware((token, req) => {
    const hasEditorRole = token.hasRealmRole('editor');
    const trustedChannel = req.headers['x-access-channel'] === 'internal-ui';
    return hasEditorRole && trustedChannel;
}), (req, res) => {
    res.send('Access granted by custom function condition');
});
```

**Example - Role array (any role matches)**

```js
// Access granted if user has ANY of these roles
app.get('/dashboard', keycloakInstance.protectMiddleware(['admin', 'manager', 'supervisor']), (req, res) => {
    const token = req.kauth.grant.access_token.content;
    res.json({ role: token.resource_access[keycloakConfig.resource]?.roles[0] });
});
```

**Example - Realm role**

```js
// Access granted only to realm admins (global role, not client-specific)
app.get('/realm-admin-only', keycloakInstance.protectMiddleware('realm:admin'), (req, res) => {
    res.send('You have realm administration privileges');
});
```

**Example - Time-based conditional access**

```js
// Route accessible only during business hours for non-admin users
app.get('/restricted-time-area', keycloakInstance.protectMiddleware((token, req) => {
    const isAdmin = token.hasRealmRole('admin');
    if (isAdmin) return true; // Admins always allowed
    
    const hour = new Date().getHours();
    return hour >= 9 && hour < 17; // Business hours only
}), (req, res) => {
    res.send('Access granted during business hours');
});
```

#### API - customProtectMiddleware(customFunction)

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

**Example - URL parameter based role**

```js
app.get('/tenant/:role', keycloakInstance.customProtectMiddleware((req) => {
    return req.params.role;
}), (req, res) => {
    res.send(`Accessing tenant with role: ${req.params.role}`);
});
```

**Example - Query parameter based role**

```js
app.get('/resource-access', keycloakInstance.customProtectMiddleware((req) => {
    // Extract role from query: /resource-access?requiredRole=viewer
    const role = req.query.requiredRole || 'user';
    return role;
}), (req, res) => {
    res.json({ message: `Accessed with role requirement: ${req.query.requiredRole}` });
});
```

**Example - Header-based role routing**

```js
app.get('/api/data', keycloakInstance.customProtectMiddleware((req) => {
    // Role determined by custom header (useful for microservices)
    const roleFromService = req.headers['x-required-role'] || 'user';
    return roleFromService;
}), (req, res) => {
    res.json({ data: 'sensitive data' });
});
```

#### API - enforcerMiddleware(conditions, options)

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

**Using `conditions` as a function**

When `conditions` is a function, it is invoked with:

- `token`: helper object exposing permission checks (for example `token.hasPermission(...)`).
- `req`: current Express request.
- `callback`: function that must be called with `true` (allow) or `false` (deny).

This mode is useful when authorization depends on multiple permissions or request-specific context (params, headers, tenant scope).
Unlike `protectMiddleware` function mode, this flow is asynchronous and callback-driven.

**Internal flow in practice**

1. Middleware resolves static permission expression(s) or executes custom async evaluator.
2. Keycloak evaluates policies against token + resource context.
3. Result is surfaced as allowed/denied (and optionally permissions payload/token mode).
4. Request continues only if policy evaluation grants access.

**Keycloak prerequisites**

- Client must have Authorization enabled.
- Policy Enforcement Mode must be configured.
- Resources, policies, and permissions must be defined in Keycloak.

**Example - Simple resource permission**

```js
app.get('/report', keycloakInstance.enforcerMiddleware('report-resource:view'), (req, res) => {
    res.render('report', { data: getReportData() });
});
```

**Example - Multiple resource permissions (any)**

```js
// User needs at least ONE of these permissions
app.get('/documents', keycloakInstance.enforcerMiddleware(
    ['document:read', 'document:admin']
), (req, res) => {
    res.json({ documents: getDocuments() });
});
```

**Example with `conditions` as function - resource-specific permission**

```js
app.get('/reports/:id', keycloakInstance.enforcerMiddleware((token, req, callback) => {
    token.hasPermission(`report:${req.params.id}:read`, (canRead) => {
        if (canRead) return callback(true);

        // Fallback permission: user can still access summary-level view
        token.hasPermission('report:summary:read', (canReadSummary) => {
            callback(!!canReadSummary);
        });
    });
}), (req, res) => {
    res.send('Access granted to report');
});
```

**Example - Ownership-based permission check**

```js
// User can only edit document they own
app.put('/document/:docId', keycloakInstance.enforcerMiddleware((token, req, callback) => {
    const docId = req.params.docId;
    const userId = token.sub; // Subject claim from token
    
    // Check if user owns this document (could also call database)
    token.hasPermission(`document:${docId}:edit`, (hasPermission) => {
        // Additional ownership check from token claims if available
        const isOwner = token.doc_owner_ids?.includes(docId);
        callback(hasPermission && isOwner);
    });
}), (req, res) => {
    res.json({ message: 'Document updated' });
});
```

#### API - customEnforcerMiddleware(customFunction, options)

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

#### API - encodeTokenRole

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

**Example - Conditional response enrichment**

```js
// Respond differently for admins vs regular users
app.get('/user-data', keycloakInstance.encodeTokenRole(), (req, res) => {
    const userData = { name: 'John', email: 'john@example.com' };
    
    if (req.encodedTokenRole.hasRole('admin')) {
        userData.adminNotes = 'User account created 2024-01-15';
        userData.accessLevel = 'full';
    } else if (req.encodedTokenRole.hasRole('viewer')) {
        userData.accessLevel = 'read-only';
    } else {
        // Remove sensitive fields for standard users
        delete userData.email;
    }
    
    res.json(userData);
});
```

**Example - Role-based feature flags**

```js
app.get('/features', keycloakInstance.encodeTokenRole(), (req, res) => {
    const features = {
        basicSearch: true,
        advancedAnalytics: req.encodedTokenRole.hasRole('premium'),
        apiAccess: req.encodedTokenRole.hasRole('developer'),
        adminPanel: req.encodedTokenRole.hasRole('realm:admin')
    };
    res.json(features);
});
```

#### API - encodeTokenPermission

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

**Example - Multi-step permission checks**

```js
app.get('/document/:docId', keycloakInstance.encodeTokenPermission(), (req, res) => {
    const docId = req.params.docId;
    
    req.encodedTokenPermission.hasPermission(`doc:${docId}:read`, (canRead) => {
        if (!canRead) return res.status(403).json({ error: 'Cannot read document' });
        
        // User can read, check if they can edit
        req.encodedTokenPermission.hasPermission(`doc:${docId}:edit`, (canEdit) => {
            res.json({
                document: getDocument(docId),
                canEdit: canEdit,
                canDelete: false // May check another permission
            });
        });
    });
});
```

**Example - Permission-based UI customization**

```js
app.get('/dashboard', keycloakInstance.encodeTokenPermission(), (req, res) => {
    const permissions = { canCreate: false, canExport: false, canShare: false };
    
    // Cascade permission checks
    req.encodedTokenPermission.hasPermission('resource:create', (can) => {
        permissions.canCreate = !!can;
    });
    
    req.encodedTokenPermission.hasPermission('resource:export', (can) => {
        permissions.canExport = !!can;
    });
    
    req.encodedTokenPermission.hasPermission('resource:share', (can) => {
        permissions.canShare = !!can;
        res.render('dashboard', permissions);
    });
});
```

#### API - loginMiddleware(redirectTo)

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

**Example**

```js
app.get('/signIn', keycloakInstance.loginMiddleware('/home'));
```

**Example - Login with post-login redirect to dashboard**

```js
app.get('/login', keycloakInstance.loginMiddleware('/dashboard'));
app.get('/signin', keycloakInstance.loginMiddleware('/dashboard')); // Alternative URL
```

**Example - Login with locale parameter**

```js
app.get('/login/:lang', keycloakInstance.loginMiddleware((req) => {
    // Redirect to different pages based on language preference
    const locale = req.params.lang;
    return `/${locale}/home`;
}));
```

#### API - logoutMiddleware(redirectTo)

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

**Example**

```js
app.get('/signOut', keycloakInstance.logoutMiddleware('http://localhost:3000/'));
```

**Example - Logout with landing page**

```js
// Logout and redirect to goodbye page
app.get('/logout', keycloakInstance.logoutMiddleware('/goodbye'));
app.get('/goodbye', (req, res) => {
    res.render('goodbye', { message: 'You have been logged out successfully' });
});
```

**Example - Logout with external URL**

```js
// Logout and redirect to external domain
app.get('/logout-and-redirect', keycloakInstance.logoutMiddleware('https://www.example.com'));
```

### Imperative and OIDC Functions

#### login vs loginPKCE vs loginWithCredentials (when to use each)

These APIs belong to different layers of the authentication/token lifecycle.

In short:

- `login(req, res, redirectTo)`: convenience helper for interactive browser login + redirect.
- `loginPKCE(credentials)`: secure callback exchange for Authorization Code + PKCE flow.
- `loginWithCredentials(credentials)`: low-level generic token endpoint client for multiple grants.

| Aspect | `login(req, res, redirectTo)` | `loginPKCE(credentials)` | `loginWithCredentials(credentials)` |
|---|---|---|---|
| Main purpose | Trigger interactive browser login and redirect user | Exchange authorization code + PKCE verifier for tokens | Generic OAuth2 token endpoint call |
| Typical phase | Login entry route in Express app | Callback route after authorization redirect | Programmatic token operations |
| Input style | Express `req`/`res` + redirect target | `code`, `redirect_uri`, `code_verifier` (+ aliases) | `grant_type` + fields required by selected grant |
| Output | Redirect side effect | Token payload | Token payload |
| Best fit | Session/server-rendered flow | PKCE-based web/mobile/SPA/BFF flows | Low-level grant handling (refresh, client credentials, etc.) |

How to read this table:

- `login(...)` is navigation-oriented (browser/session behavior).
- `loginPKCE(...)` and `loginWithCredentials(...)` are token-oriented (you receive token objects to manage in code).

Use `login(...)` when:

- You want middleware-managed interactive login with redirect.
- You are coding route-level navigation flow in Express.

#### loginMiddleware() vs login() (same goal, different style)

Both APIs are designed to trigger interactive authentication and then redirect, but they are used in different coding styles.

| Aspect | `loginMiddleware(redirectTo)` | `login(req, res, redirectTo)` |
|---|---|---|
| Type | Route middleware | Imperative helper function |
| Where used | Directly in route declaration | Inside route handler body |
| Handler execution | Usually not reached after middleware redirect flow | You can run custom logic before calling `login()` |
| Best for | Standard login endpoint with minimal code | Conditional login or pre-login business logic |

Use `loginMiddleware(...)` when:

- You want a clean declarative route such as `app.get('/signin', keycloak.loginMiddleware('/home'))`.
- You do not need custom pre-checks before triggering login.

Use `login(...)` when:

- You need to execute custom code before forcing authentication.
- Login should happen only under specific runtime conditions.

Equivalent intent examples:

```js
// Middleware style
app.get('/signIn', keycloakInstance.loginMiddleware('/home'));

// Imperative style
app.get('/signIn', (req, res) => {
    // Custom logic can run here first
    keycloakInstance.login(req, res, '/home');
});
```

> **Note:** `login(...)` was added as a convenience helper.
> You can reach the same authentication result using `protectMiddleware()` and then redirect manually.

Equivalent behavior with `protectMiddleware()`:

```js
app.get('/signIn', keycloakInstance.protectMiddleware(), (req, res) => {
    res.redirect('/home');
});
```

Use `loginPKCE(...)` when:

- You already initiated PKCE with `generateAuthorizationUrl(...)`.
- You are handling callback exchange securely using stored `codeVerifier`.

What `loginPKCE(...)` actually does:

- Validates required PKCE callback inputs (`code`, `redirect_uri`, `code_verifier`).
- Calls the token endpoint with grant type `authorization_code` and PKCE verifier.
- Returns token payload for your own persistence/session strategy.

Client configuration note for PKCE:

- `loginPKCE(...)` uses Authorization Code + PKCE and does **not** require `Direct Access Grants`.

Use `loginWithCredentials(...)` when:

- You need direct token endpoint operations (e.g., refresh token, client credentials, custom grant handling).
- You need a reusable low-level method for different OAuth2 grant payloads.

What `loginWithCredentials(...)` actually does:

- Builds and sends a generic `application/x-www-form-urlencoded` token request.
- Supports multiple grant models by payload (`password`, `client_credentials`, `authorization_code`, `refresh_token`).
- Returns raw token endpoint response or throws error on failure.

Client configuration note for non-browser password login:

- When `loginWithCredentials(...)` is used with `grant_type=password`, the client must have `Direct Access Grants` enabled in Keycloak.
- This means the client handles username/password directly and exchanges them with Keycloak token endpoint.
- In OAuth2 terms, this enables `Resource Owner Password Credentials Grant` support for that client.

Recommended PKCE sequence:

1. Start flow with `generateAuthorizationUrl(...)` and persist `state` + `codeVerifier` server-side.
2. Redirect user to generated authorization URL.
3. Receive authorization `code` in callback.
4. Exchange using `loginPKCE(...)`.
5. Use/persist tokens according to your session/token strategy.

#### API - login(req, res, redirectTo)

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

**Example**

```js
app.get('/login-if-needed', (req, res) => {
    const needsInteractiveLogin = !req.session?.alreadyValidated;
    if (!needsInteractiveLogin) return res.redirect('/home');
    keycloakInstance.login(req, res, '/home');
});
```

**Example - Login with audit logging**

```js
app.get('/signin', (req, res) => {
    console.log(`Login attempt from IP: ${req.ip}`);
    req.session.loginAttemptTime = new Date();
    keycloakInstance.login(req, res, '/dashboard');
});
```

**Example - Conditional login based on session state**

```js
app.get('/secure-area', (req, res) => {
    if (req.session?.user) {
        // Already logged in, show content
        return res.render('secure-area');
    }
    // Not logged in, trigger authentication
    keycloakInstance.login(req, res, '/secure-area');
});
```

#### API - logout(req, res, redirectTo)

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

**Example**

```js
app.get('/logout-now', (req, res) => {
    keycloakInstance.logout(req, res, 'http://localhost:3000/');
});
```

**Example - Logout with user feedback**

```js
app.get('/logout', (req, res) => {
    const username = req.kauth?.grant?.access_token?.content?.preferred_username || 'User';
    console.log(`${username} logged out at ${new Date().toISOString()}`);
    
    // Audit log could go here
    req.session.logoutTime = new Date();
    
    keycloakInstance.logout(req, res, 'http://localhost:3000/logged-out');
});
```

**Example - Conditional logout with cleanup**

```js
app.get('/exit', async (req, res) => {
    // Perform cleanup before logout
    if (req.session?.userId) {
        await cleanupUserResources(req.session.userId);
    }
    keycloakInstance.logout(req, res, '/goodbye');
});
```

#### API - generateAuthorizationUrl(options)

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

**Example - Basic PKCE initialization**

```js
const pkce = keycloakInstance.generateAuthorizationUrl({
    redirect_uri: 'https://app.example.com/auth/callback'
});
req.session.pkce_state = pkce.state;
req.session.pkce_verifier = pkce.codeVerifier;
res.redirect(pkce.authUrl);
```

**Example - PKCE with custom scope**

```js
const pkce = keycloakInstance.generateAuthorizationUrl({
    redirect_uri: 'https://app.example.com/callback',
    scope: 'openid profile email offline_access'
});

// Store in session or state management
req.session.pkce_state = pkce.state;
req.session.pkce_verifier = pkce.codeVerifier;
req.session.auth_initiated_at = Date.now();

res.json({
    authorization_url: pkce.authUrl,
    // Frontend should store state/verifier safely
});
```

**Example - PKCE with custom state**

```js
const customState = `state_${Date.now()}_${Math.random()}`;
const pkce = keycloakInstance.generateAuthorizationUrl({
    redirect_uri: 'https://api.example.com/oauth/callback',
    scope: 'openid profile',
    state: customState
});

// Verify state in callback to prevent CSRF attacks
req.session.oauth_state = customState;
res.redirect(pkce.authUrl);
```

#### API - loginWithCredentials(credentials)

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

**Client configuration requirement (`password` grant only)**

- If you call `loginWithCredentials(...)` with `grant_type=password`, the Keycloak client must have `Direct Access Grants` enabled.
- This corresponds to OAuth2 `Resource Owner Password Credentials Grant` for that client.
- This requirement does not apply to `client_credentials`, `refresh_token`, or `authorization_code` payloads.

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

**Example - Refresh token grant**

```js
const refreshed = await keycloakInstance.loginWithCredentials({
    grant_type: 'refresh_token',
    refresh_token: storedRefreshToken
});
```

**Example - Password grant (Direct Access Grants required)**

```js
// Requires "Direct Access Grants" enabled on Keycloak client
const tokens = await keycloakInstance.loginWithCredentials({
    grant_type: 'password',
    username: 'user@example.com',
    password: 'userPassword123',
    scope: 'openid profile email'
});

req.session.access_token = tokens.access_token;
res.json({ success: true, token_type: tokens.token_type });
```

**Example - Client credentials grant (service-to-service)**

```js
// Get token as a service/application (not user-specific)
const serviceToken = await keycloakInstance.loginWithCredentials({
    grant_type: 'client_credentials',
    client_id: process.env.KEYCLOAK_CLIENT_ID,
    client_secret: process.env.KEYCLOAK_CLIENT_SECRET,
    scope: 'openid'
});

// Use token to call protected APIs
const apiResponse = await fetch('https://api.example.com/data', {
    headers: { 'Authorization': `Bearer ${serviceToken.access_token}` }
});
```

#### API - loginPKCE(credentials)

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
- PKCE callback exchange does not require `Direct Access Grants`.

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

**Example - Full PKCE callback flow**

```js
app.get('/auth/callback', async (req, res) => {
    try {
        // Verify state to prevent CSRF
        if (req.query.state !== req.session.pkce_state) {
            throw new Error('State mismatch - possible CSRF attack');
        }

        // Exchange code and verifier for tokens
        const tokens = await keycloakInstance.loginPKCE({
            code: req.query.code,
            redirect_uri: process.env.OAUTH_CALLBACK_URL,
            code_verifier: req.session.pkce_verifier
        });

        // Store tokens securely
        req.session.access_token = tokens.access_token;
        req.session.refresh_token = tokens.refresh_token;
        req.session.user_authenticated = true;

        res.redirect('/dashboard');
    } catch (err) {
        console.error('PKCE exchange failed:', err);
        res.status(401).json({ error: 'Authentication failed' });
    }
});
```

**Example - PKCE with automatic token refresh**

```js
app.get('/auth/callback', async (req, res) => {
    try {
        const tokens = await keycloakInstance.loginPKCE({
            code: req.query.code,
            redirect_uri: 'https://app.example.com/callback',
            code_verifier: req.session.pkce_verifier
        });

        // Store tokens and setup auto-refresh
        req.session.access_token = tokens.access_token;
        req.session.refresh_token = tokens.refresh_token;
        req.session.token_expires_at = Date.now() + (tokens.expires_in * 1000);

        // Schedule token refresh
        setTimeout(() => refreshAccessToken(req), (tokens.expires_in - 30) * 1000);

        res.redirect('/home');
    } catch (err) {
        res.status(401).send('Authentication failed');
    }
});
```

#### API - redirectToUserAccountConsole(res)

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

**Example**

```js
app.get('/my-account', (req, res) => {
    keycloakInstance.redirectToUserAccountConsole(res);
});
```

**Example - Account management link in profile page**

```js
app.get('/profile', keycloakInstance.protectMiddleware(), (req, res) => {
    const user = req.kauth.grant.access_token.content;
    res.render('profile', {
        user: user.preferred_username,
        manageAccountUrl: '/manage-account' // This endpoint redirects via redirectToUserAccountConsole
    });
});

app.get('/manage-account', keycloakInstance.protectMiddleware(), (req, res) => {
    keycloakInstance.redirectToUserAccountConsole(res);
});
```

**Example - Security settings redirect**

```js
// Direct users to change password, 2FA settings, etc.
app.get('/security-settings', keycloakInstance.protectMiddleware(), (req, res) => {
    keycloakInstance.redirectToUserAccountConsole(res);
});
```

#### API - hasScope(scopeInput, requiredScope)

**Signature**

```js
hasScope(scopeInput, requiredScope)
```

Checks whether one scope is present in a scope string or array.

**What this API is for**

- Use this helper to check scopes without rewriting parsing logic in every route.
- Works with both middleware token claims and token endpoint responses.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `scopeInput` | `string \| string[]` | Yes | Scope source (`"openid profile email"` or `['openid', 'profile']`). |
| `requiredScope` | `string` | Yes | Scope to verify. |

**Returns**

- `boolean`: `true` if scope exists, otherwise `false`.

**Example - Email scope check**

```js
const tokenScope = req?.kauth?.grant?.access_token?.content?.scope;
const canReadEmail = keycloakInstance.hasScope(tokenScope, 'email');
```

**Example - Checking multiple scopes one by one**

```js
const scope = 'openid profile email'; // From token

const hasOpenId = keycloakInstance.hasScope(scope, 'openid'); // true
const hasOfflineAccess = keycloakInstance.hasScope(scope, 'offline_access'); // false
const hasEmail = keycloakInstance.hasScope(scope, 'email'); // true

res.json({ hasOpenId, hasOfflineAccess, hasEmail });
```

**Example - Response based on scope availability**

```js
const scope = req?.kauth?.grant?.access_token?.content?.scope || '';

const response = {
    profile: true,
    email: keycloakInstance.hasScope(scope, 'email'),
    phone: keycloakInstance.hasScope(scope, 'phone'),
    address: keycloakInstance.hasScope(scope, 'address')
};

res.json(response);
```

#### API - hasScopes(scopeInput, requiredScopes, mode)

**Signature**

```js
hasScopes(scopeInput, requiredScopes, mode = 'all')
```

Checks multiple scopes with `all` (default) or `any` matching mode.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `scopeInput` | `string \| string[]` | Yes | Scope source (`"openid profile email"` or array). |
| `requiredScopes` | `string \| string[]` | Yes | One or more scopes to evaluate. |
| `mode` | `'all' \| 'any'` | No | `all` requires all scopes, `any` requires at least one. |

**Returns**

- `boolean`: scope validation result.

**Example - Check all required scopes**

```js
const scopeString = tokenResponse.scope;

const hasAll = keycloakInstance.hasScopes(
    scopeString,
    ['openid', 'profile'],
    'all'
);

const hasAny = keycloakInstance.hasScopes(
    scopeString,
    ['email', 'offline_access'],
    'any'
);
```

**Example - Scope validation before API call**

```js
app.get('/user-data', keycloakInstance.protectMiddleware(), (req, res) => {
    const scope = req?.kauth?.grant?.access_token?.content?.scope || '';
    
    // Check required scopes
    const canAccessProfile = keycloakInstance.hasScope(scope, 'profile');
    const canAccessEmail = keycloakInstance.hasScope(scope, 'email');
    
    if (!canAccessProfile) {
        return res.status(403).json({ error: 'Missing profile scope' });
    }
    
    const userData = {
        profile: getUserProfile(req),
        email: canAccessEmail ? getUserEmail(req) : null
    };
    
    res.json(userData);
});
```

**Example - Delegated vs direct access scopes**

```js
const scope = tokenResponse.scope;

// check for offline access (allows refresh tokens)
const canRefresh = keycloakInstance.hasScope(scope, 'offline_access');

// Check for direct API access vs SSO-only
const canUseDirectAPI = keycloakInstance.hasScopes(
    scope,
    ['api-access', 'direct-auth'],
    'any'
);

res.json({
    sessionRefresh: canRefresh,
    apiAccess: canUseDirectAPI
});
```

#### API - getTokenClaims(req)

**Signature**

```js
getTokenClaims(req)
```

Safely returns decoded access token claims from request.

**Returns**

- `Object`: token claims object, or `{}` if token is unavailable.

**Example**

```js
const claims = keycloakInstance.getTokenClaims(req);
const username = claims.preferred_username;
```

**Example - Extract multiple claims**

```js
app.get('/token-info', keycloakInstance.protectMiddleware(), (req, res) => {
    const claims = keycloakInstance.getTokenClaims(req);
    
    res.json({
        username: claims.preferred_username,
        email: claims.email,
        givenName: claims.given_name,
        familyName: claims.family_name,
        expiresAt: new Date(claims.exp * 1000).toISOString()
    });
});
```

**Example - Token inspection/debugging**

```js
app.get('/debug/token', keycloakInstance.protectMiddleware(), (req, res) => {
    const claims = keycloakInstance.getTokenClaims(req);
    
    if (process.env.NODE_ENV === 'development') {
        res.json({
            allClaims: claims,
            tokenValid: claims.exp > Date.now() / 1000,
            issuedAt: new Date(claims.iat * 1000),
            expiresAt: new Date(claims.exp * 1000)
        });
    } else {
        res.status(403).send('Not available in production');
    }
});
```

#### API - isAuthenticated(req)

**Signature**

```js
isAuthenticated(req)
```

Checks whether request contains a Keycloak access token.

**Returns**

- `boolean`.

**Example**

```js
if (!keycloakInstance.isAuthenticated(req)) {
    return res.status(401).send('Not authenticated');
}
```

**Example - Conditional rendering**

```js
app.get('/content', (req, res) => {
    if (!keycloakInstance.isAuthenticated(req)) {
        return res.render('login-prompt');
    }
    res.render('protected-content');
});
```

**Example - Middleware-less authentication check**

```js
app.get('/optional-features', (req, res) => {
    const isAuth = keycloakInstance.isAuthenticated(req);
    
    const features = {
        basicRead: true,
        advancedSearch: isAuth,
        exportData: isAuth,
        collaboration: isAuth && req.kauth?.grant?.access_token?.content?.realm_access?.roles?.includes('premium')
    };
    
    res.json(features);
});
```

#### API - getScopes(scopeInputOrReq)

**Signature**

```js
getScopes(scopeInputOrReq)
```

Normalizes scopes to an array from one of:

- scope string
- scope array
- Express request (`req.kauth.grant.access_token.content.scope`)

**Returns**

- `string[]`.

**Example**

```js
const scopes = keycloakInstance.getScopes(req);
// ['openid', 'profile', 'email']
```

**Example - Normalizing different input types**

```js
app.get('/scope-test', keycloakInstance.protectMiddleware(), (req, res) => {
    // All these return the same format: string[]
    const fromRequest = keycloakInstance.getScopes(req);
    const fromString = keycloakInstance.getScopes('openid profile email');
    const fromArray = keycloakInstance.getScopes(['openid', 'profile', 'email']);
    
    res.json({
        fromRequest,
        fromString,
        fromArray,
        allEqual: JSON.stringify(fromRequest) === JSON.stringify(fromString)
    });
});
```

**Example - Scope availability dashboard**

```js
app.get('/scopes', keycloakInstance.protectMiddleware(), (req, res) => {
    const scopes = keycloakInstance.getScopes(req);
    
    const scopeInfo = {
        total: scopes.length,
        list: scopes,
        capabilities: {
            userInfo: scopes.includes('profile'),
            emailAccess: scopes.includes('email'),
            offlineAccess: scopes.includes('offline_access'),
            mobileAccess: scopes.includes('mobile')
        }
    };
    
    res.json(scopeInfo);
});
```

#### API - hasScopeFromRequest(req, requiredScope)

**Signature**

```js
hasScopeFromRequest(req, requiredScope)
```

Convenience wrapper around `hasScope(...)` using request token claims.

**Returns**

- `boolean`.

**Example**

```js
const canReadEmail = keycloakInstance.hasScopeFromRequest(req, 'email');
```

**Example - Scope-based response customization**

```js
app.get('/user-profile', keycloakInstance.protectMiddleware(), (req, res) => {
    const profile = {
        username: keycloakInstance.getTokenClaims(req).preferred_username
    };
    
    // Include email only if user granted email scope
    if (keycloakInstance.hasScopeFromRequest(req, 'email')) {
        profile.email = keycloakInstance.getTokenClaims(req).email;
    }
    
    // Include phone only if both phone and profile scopes
    if (keycloakInstance.hasScopeFromRequest(req, 'phone')) {
        profile.phone = keycloakInstance.getTokenClaims(req).phone_number;
    }
    
    res.json(profile);
});
```

#### API - hasScopesFromRequest(req, requiredScopes, mode)

**Signature**

```js
hasScopesFromRequest(req, requiredScopes, mode = 'all')
```

Convenience wrapper around `hasScopes(...)` using request token claims.

**Returns**

- `boolean`.

**Example**

```js
const allowed = keycloakInstance.hasScopesFromRequest(
    req,
    ['openid', 'profile'],
    'all'
);
```

**Example - Multi-scope requirement check**

```js
app.get('/sensitive-data', keycloakInstance.protectMiddleware(), (req, res) => {
    // Require both openid AND profile scopes
    const hasRequired = keycloakInstance.hasScopesFromRequest(
        req,
        ['openid', 'profile'],
        'all'
    );
    
    if (!hasRequired) {
        return res.status(403).json({ error: 'Insufficient scopes. Required: openid, profile' });
    }
    
    res.json({ data: 'sensitive information' });
});
```

**Example - Flexible requirements with 'any' mode**

```js
app.get('/export-data', keycloakInstance.protectMiddleware(), (req, res) => {
    // User needs at least ONE of these scopes to export
    const canExport = keycloakInstance.hasScopesFromRequest(
        req,
        ['export-csv', 'export-excel', 'export-pdf'],
        'any'
    );
    
    if (!canExport) {
        return res.status(403).json({ error: 'Export permission required' });
    }
    
    res.attachment('data.csv').send(exportData());
});
```

#### API - requireScopes(requiredScopes, mode)

**Signature**

```js
requireScopes(requiredScopes, mode = 'all')
```

Express middleware that enforces scopes and responds `403` if missing.

**Returns**

- Middleware return.

**Example**

```js
app.get(
    '/profile-email',
    keycloakInstance.protectMiddleware(),
    keycloakInstance.requireScopes(['email'], 'all'),
    (req, res) => res.send('Scope check passed')
);
```

**Example - Multiple scope checks in chain**

```js
app.post(
    '/api/send-notification',
    keycloakInstance.protectMiddleware(),
    keycloakInstance.requireScopes(['email', 'notifications'], 'all'), // All required
    async (req, res) => {
        const email = keycloakInstance.getTokenClaims(req).email;
        await sendNotification(email, req.body);
        res.json({ sent: true });
    }
);
```

**Example - Endpoint with flexible scope requirements**

```js
app.get(
    '/data-export',
    keycloakInstance.protectMiddleware(),
    keycloakInstance.requireScopes(['export-csv', 'export-json', 'export-excel'], 'any'), // At least one
    (req, res) => {
        const format = req.query.format || 'csv';
        res.json({ exported: true, format });
    }
);
```

**Example - Scope enforcement with custom error responses**

```js
// Custom middleware that wraps requireScopes with better error handling
const requireScopesWithLogging = (requiredScopes, mode = 'all') => {
    return (req, res, next) => {
        const middleware = keycloakInstance.requireScopes(requiredScopes, mode);
        
        // Log scope checks
        console.log(`Scope check [${mode}]: ${requiredScopes.join(', ')} on ${req.path}`);
        
        // Call the middleware
        middleware(req, res, next);
    };
};

app.get(
    '/premium-feature',
    keycloakInstance.protectMiddleware(),
    requireScopesWithLogging(['premium'], 'all'),
    (req, res) => res.send('Premium feature accessed')
);
```

---
## Recipes and Patterns

For complete end-to-end integration examples showing how multiple APIs work together, see the dedicated guide:

**[Recipes and Patterns &rarr;](docs/recipes.md)**

Covers: PKCE login flow, multi-tenant setup, layered authorization (role + scope + permission), adaptive API responses, service-to-service token flow, login/logout lifecycle, scope-gated REST endpoints, and custom 401/403 UX.

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


