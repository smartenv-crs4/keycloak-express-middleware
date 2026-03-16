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
- [Full Usage Example](#full-usage-example)
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
## API Documentation

This section documents each public API exposed by the middleware class.

### API - Constructor

`new keycloakAdapter(app, keycloakConfig, keycloakOptions = {})`

Creates an independent middleware instance bound to one Keycloak client.

Parameters:

- `app` (Object, required): Express app or router instance.
- `keycloakConfig` (Object, required): Keycloak client config (`realm`, `auth-server-url`, `resource`, `credentials`, etc.).
- `keycloakOptions` (Object, optional): advanced options.

Supported options in `keycloakOptions`:

- `session` (Object): when provided, the adapter initializes `express-session` with MemoryStore.
- `session.secret` (string): session secret.
- `session.resave` (boolean): Express session `resave`.
- `session.saveUninitialized` (boolean): Express session `saveUninitialized`.
- `realmName` (string): optional realm override.
- `clientId` (string): optional client id override.
- `clientSecret` (string): optional client secret override.
- `scope`, `idpHint`, `cookies`, `realmUrl` (optional): forwarded to Keycloak adapter behavior.

Returns:

- A configured middleware instance.

### API - underKeycloakProtection (deprecated)

`underKeycloakProtection(callback)`

Deprecated helper kept for backward compatibility. It executes `callback` when middleware is ready.

Parameters:

- `callback` (Function, required): function used to declare protected routes.

Returns:

- `void`.

Example:

```js
keycloakInstance.underKeycloakProtection(() => {
    app.get('/private', keycloakInstance.protectMiddleware(), handler);
});
```

### API - protectMiddleware(conditions)

`protectMiddleware(conditions)`

Protects a route by authentication and optional role checks.

Parameters:

- `conditions` (optional): one of
- `undefined` or `null`: authentication only.
- `string`: one role expression.
- `string[]`: any-of role expressions.
- `function(token, req): boolean`: custom synchronous authorization predicate.

Role formats:

- `'admin'`: role in configured client.
- `'realm:admin'`: realm role.
- `'clientid:role'`: role in another client.

Returns:

- Express middleware function.

Token access in route handlers:

- `req.kauth.grant.access_token.content` exposes token claims (scope, username, email, roles, custom claims).

Example:

```js
app.get('/admin', keycloakInstance.protectMiddleware('admin'), (req, res) => {
    const token = req.kauth.grant.access_token.content;
    res.json({ user: token.preferred_username, scope: token.scope });
});
```

### API - customProtectMiddleware(customFunction)

`customProtectMiddleware(customFunction)`

Builds the role expression dynamically per request.

Parameters:

- `customFunction` (Function, required): `(req, res) => string`.

Returns:

- Express middleware function.

Example:

```js
app.get('/tenant/:role', keycloakInstance.customProtectMiddleware((req) => {
    return req.params.role;
}), handler);
```

### API - enforcerMiddleware(conditions, options)

`enforcerMiddleware(conditions, options)`

Performs permission checks using Keycloak Authorization Services (UMA 2.0).

Parameters:

- `conditions` (required): one of
- `string | string[]`: static permission/resource expression(s).
- `function(token, req, callback)`: custom async check where `callback(true|false)` decides access.
- `options` (Object, optional): forwarded to `keycloak.enforcer(...)`.
- `options.response_mode`: `'permissions'` (default) or `'token'`.
- `options.claims`: claims object for policy evaluation.
- `options.resource_server_id`: resource server client id.

Returns:

- Express middleware function.

Example:

```js
app.get('/report', keycloakInstance.enforcerMiddleware('report-resource:view'), handler);
```

### API - customEnforcerMiddleware(customFunction, options)

`customEnforcerMiddleware(customFunction, options)`

Same model as `enforcerMiddleware`, but the permission string is generated from request context.

Parameters:

- `customFunction` (Function, required): `(req, res) => string`.
- `options` (Object, optional): same options accepted by `enforcerMiddleware`.

Returns:

- Express middleware function.

Example:

```js
app.get('/resource/:permission', keycloakInstance.customEnforcerMiddleware((req) => {
    return req.params.permission;
}), handler);
```

### API - encodeTokenRole

`encodeTokenRole()`

Decodes token and stores it in `req.encodedTokenRole` without directly performing role denial logic.

Returns:

- Express middleware function.

Exposed helper methods on `req.encodedTokenRole`:

- `hasRole('admin')`
- `hasRole('realm:admin')`
- `hasRole('clientid:editor')`
- `hasResourceRole('editor', 'clientid')`

Example:

```js
app.get('/profile', keycloakInstance.encodeTokenRole(), (req, res) => {
    const isRealmAdmin = req.encodedTokenRole.hasRole('realm:admin');
    res.json({ isRealmAdmin });
});
```

### API - encodeTokenPermission

`encodeTokenPermission()`

Adds `req.encodedTokenPermission` with a permission probe helper.

Returns:

- Express middleware function.

Exposed API:

- `req.encodedTokenPermission.hasPermission(permission, callback)`

Parameters of helper:

- `permission` (string): permission expression to check.
- `callback` (Function): receives `true` when allowed, `false` otherwise.

Example:

```js
app.get('/can-read', keycloakInstance.encodeTokenPermission(), (req, res) => {
    req.encodedTokenPermission.hasPermission('doc:read', (ok) => {
        if (ok) return res.send('Allowed');
        res.status(403).send('Denied');
    });
});
```

### API - loginMiddleware(redirectTo)

`loginMiddleware(redirectTo)`

Forces authentication flow and redirects authenticated users to `redirectTo`.

Parameters:

- `redirectTo` (string, required): post-login redirect URL.

Returns:

- Middleware chain (protect + redirect handler).

Note:

- Route callback after this middleware is not expected to run.

### API - logoutMiddleware(redirectTo)

`logoutMiddleware(redirectTo)`

Destroys local session and redirects through Keycloak logout endpoint when token exists.

Parameters:

- `redirectTo` (string, required): post-logout redirect URL.

Returns:

- Express middleware function.

Behavior:

- If `id_token` exists: builds logout URL, destroys session, redirects to Keycloak logout.
- If token is missing: direct redirect to `redirectTo`.

### API - login(req, res, redirectTo)

`login(req, res, redirectTo)`

Imperative login function for route-handler usage.

Parameters:

- `req` (Object, required): Express request.
- `res` (Object, required): Express response.
- `redirectTo` (string, required): destination after successful authentication.

Returns:

- `void`.

### API - logout(req, res, redirectTo)

`logout(req, res, redirectTo)`

Imperative logout function for route-handler usage.

Parameters:

- `req` (Object, required): Express request.
- `res` (Object, required): Express response.
- `redirectTo` (string, required): destination after logout.

Returns:

- `void`.

### API - generateAuthorizationUrl(options)

`generateAuthorizationUrl(options = {})`

Generates authorization URL and PKCE values for login initiation.

Parameters:

- `options.redirect_uri` (string, required): callback URL.
- `options.redirectUri` (string, optional): camelCase alias of `redirect_uri`.
- `options.scope` (string, optional): default is `openid profile email`.
- `options.state` (string, optional): custom state; auto-generated when omitted.

Returns:

- Object with:
- `authUrl` (string): full authorization URL.
- `state` (string): CSRF state value.
- `codeVerifier` (string): PKCE verifier to store server-side.

Example:

```js
const pkce = keycloakInstance.generateAuthorizationUrl({
    redirect_uri: 'https://app.example.com/auth/callback'
});
req.session.pkce_state = pkce.state;
req.session.pkce_verifier = pkce.codeVerifier;
res.redirect(pkce.authUrl);
```

### API - loginWithCredentials(credentials)

`async loginWithCredentials(credentials = {})`

Generic OAuth2 token endpoint helper.

Parameters:

- `credentials.grant_type` (string, required): OAuth2 grant type.
- Common optional fields:
- `username`, `password` (password grant)
- `client_id`, `client_secret`
- `refresh_token`
- `code`, `redirect_uri`
- `scope`

Returns:

- `Promise<Object>` token payload from Keycloak.

Throws:

- `Error` when request fails or payload reports authentication errors.

### API - loginPKCE(credentials)

`async loginPKCE(credentials = {})`

Specialized helper for authorization-code + PKCE callback exchange.

Parameters:

- `credentials.code` (string, required): authorization code.
- `credentials.redirect_uri` or `credentials.redirectUri` (string, required).
- `credentials.code_verifier` or `credentials.codeVerifier` (string, required).
- Optional aliases: `client_id/clientId`, `client_secret/clientSecret`, plus other token params.

Returns:

- `Promise<Object>` token payload.

Throws:

- `Error` when required PKCE fields are missing or exchange fails.

Example:

```js
const tokens = await keycloakInstance.loginPKCE({
    code: req.query.code,
    redirect_uri: 'https://app.example.com/auth/callback',
    code_verifier: req.session.pkce_verifier
});
```

### API - redirectToUserAccountConsole(res)

`redirectToUserAccountConsole(res)`

Redirects user to Keycloak account console endpoint for current realm.

Parameters:

- `res` (Object, required): Express response.

Returns:

- `void`.

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


