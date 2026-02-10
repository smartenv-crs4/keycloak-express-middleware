# 🔐 Keycloak Express middleware for Node.js (Express)
An adapter API to seamlessly integrate **Node.js Express** applications with **Keycloak** for authentication and authorization using **OpenID Connect (OIDC)**.
This middleware provides route protection, token validation, user role management. Ideal for securing RESTful services, microservices, Express-based backends, and express or javascript frontends.
it is based on **'keycloak-connect'**, and **'express-session'**


---
## 📦 Features
- 🔑 OIDC-based authentication with Keycloak
- 🧾 Access token validation (JWT)
- 🔐 Route protection via role-based access control
- 🔁 Automatic token refresh (optional)
- ⚙️ Configurable Keycloak client and realm settings
- 👤 User info extraction from token
- 🌍 CORS support and integration with frontend apps (SPA or mobile)
---
## ⚠️ keycloak-express-middleware evolution starting from Version 4.0.0
The new version of keycloak-express-middleware (currently at version 6.0.2) introduces a substantial evolution in its architecture. 
It now embraces an object-oriented paradigm, which means each instance of the middleware is self-contained and independent. 
Concretely, you can instantiate the library multiple times within the same application—each time pointing to a different client in Keycloak 
and the instances will not share internal connections or state across modules. 
This is a major shift from the previous version(until 3.0.9), where the library maintained a single shared 
connection and did not support using distinct Keycloak clients simultaneously within the same 
application scope.  By moving to this new ***one instance = one client*** model, you gain the flexibility to support scenarios such as:
 - a single Express application acting as multiple Keycloak clients, each with different realms, client-ids or roles, 
 - isolating middleware logic per client without risking cross-contamination of sessions or grants, 
 - simplifying multitenancy or micro-service architectures where different parts of an app authenticate against different Keycloak clients. 
 
**To summarize:** the new version (4.0.0+, currently 6.0.2) enables multi-client usage within the same app by turning the middleware into configurable,
independent object instances — something that the earlier version did not support.

### 🏗️ Migration Guide: From Old to New Version

🧩 Old Version (pre–object-oriented)
```js
// OLD VERSION UP TO 3.0.9
const express = require('express');
const keycloackAdapter = require('keycloak-express-middleware');

const app = express();
await keycloackAdapter.configure(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
        "resource": "keycloackclientName",
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

// Example of protection with keycloackAdapter.protectMiddleware middleware
// whith a static client role validation string
// Access is allowed only for authenticated admin users
app.get('/privateStaticClientRole', keycloackAdapter.protectMiddleware("admin"), (req, res) => {
    // "Your Custom Code"
    res.send("Is its admin.");
});
```

🆕 New Version (Object-Oriented Design) - Version 4.0.0+

```js
// NEW VERSION STARTING FROM 4.0.0 (currently 6.0.2)
const express = require('express');
const { keycloackAdapter } = require('keycloak-express-middleware');

const app = express();

// Create independent Keycloak clients
const keycloakA = new keycloackAdapter(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
        "resource": "keycloackclientName_A",
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

const keycloakB = new keycloackAdapter(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
        "resource": "keycloackclientName_B",
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
## 🚀 Installation
```bash
npm install keycloak-express-middleware
```
Or, if using Yarn:
```bash
yarn add keycloak-express-middleware
```
---
## 🛠️ Get Keycloak Configuration
Copy or Download from keycloak admin page your client configuration `keycloak.json` by visiting 
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
## 📄 Usage Example
```js
const express = require('express');
// CommonJS - Default import
const keycloackAdapter = require('keycloak-express-middleware');

// ES6 - Named import (recommended for clarity)
// import { keycloackAdapter } from 'keycloak-express-middleware';

// ES6 - Default import
// import keycloackAdapter from 'keycloak-express-middleware';

const app = express();


// Configure and Initialize Keycloak adapter
const keycloakInstance = new keycloackAdapter(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
        "resource": "keycloackclientName",
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

/*
OLD STYLE UP TO VERSION 3.0.9
// Configure and Initialize Keycloak adapter
await keycloackAdapter.configure(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
        "resource": "keycloackclientName",
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
*/



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
app.get('/logoutMiddle', keycloakInstance.logoutMiddleware("http://redirctUrl"), (req, res) => {
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
// whith a static client role validation string
// Access is allowed only for authenticated admin users
app.get('/privateStaticClientRole', keycloakInstance.protectMiddleware("admin"), (req, res) => {
    // "Your Custom Code"
    res.send("Is its admin.");
});

// Example of protection with keycloakInstance.protectMiddleware middleware
// whith a static realm role validation string
// Access is allowed only for authenticated realm admin users
app.get('/privateStaticRealmRole', keycloakInstance.protectMiddleware("realm:admin"), (req, res) => {
    // "Your Custom Code"
    res.send("Is its admin realm:admin.");
});

// Example of protection with keycloakInstance.protectMiddleware middleware
// whith a static other client role validation string
// Access is allowed only for authenticated otherClient admin users
app.get('/privateStaticRealmRole', keycloakInstance.protectMiddleware("otherClient:admin"), (req, res) => {
    // "Your Custom Code"
    res.send("Is its admin otherClient:admin.");
});

// Example of protection with keycloakInstance.protectMiddleware middleware
// whith a control function tmpFunction
// Access is allowed only for authenticated admin users
let tmpFunction=function (token, req) {
    return token.hasRole('admin');
}
app.get('/isAdmin', keycloakInstance.protectMiddleware(tmpFunction), (req, res) => {
    // "Your Custom Code"
    res.send("Is its admin tmpFunction.");
});


// Example of protection with keycloakInstance.customProtectMiddleware middleware
// whith a control function tmpFunctionString
// Access is allowed only for authenticated users with role defined by tmpFunctionString
let tmpFunctionString=function (req,res) {
    let id=req.params.id
    // Control String by url param Id 
    return (`${id}`);
}
app.get('/:id/isAdmin', keycloakInstance.customProtectMiddleware(tmpFunctionString), (req, res) => {
    // "Your Custom Code"
    res.send("Is its admin tmpFunctionString.");
});


// Example of protection with keycloakInstance.encodeTokenRole middleware
// Encode the token and add it to req.encodedTokenRole
// Use req.encodedTokenRole.hasRole("role") to check whether the token has that role or not
app.get('/encodeToken', keycloakInstance.encodeTokenRole(), (req, res) => {
    if(req.encodedTokenRole.hasRole('realm:admin'))
        res.send("Is its a realm admin");
    else
        res.send("Is its'n a realm admin");

});


// #####################################################################################
// #   This section provides examples of how to protect resources based on permissions #
// #   rather than roles.                                                              #                                
// #####################################################################################


// Example of protection with keycloakInstance.enforcerMiddleware middleware
// whith a static control string
// Access is allowed only for users with 'ui-admin-resource' permission defined 
// in keycloak
app.get('/adminResource', keycloakInstance.enforcerMiddleware('ui-admin-resource'), (req, res) => {
    // If this section is reached, the user has the required privileges; 
    // otherwise, the middleware responds with a 403 Access Denied.
    res.send('You are an authorized ui-admin-resource User');
});

// Example of protection with keycloakInstance.enforcerMiddleware middleware
// whith a control function tmpFunctionEnforceValidation
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
app.get('/adminOrViewerResorce', keycloakInstance.enforcerMiddleware(tmpFunctionEnforceValidation), (req, res) => {
    // If this section is reached, the user has the required privileges 
    // driven by tmpFunctionEnforceValidation; otherwise, the middleware responds
    // with a 403 Access Denied.
    res.send('You are an authorized User');
});


// Example of protection with keycloakInstance.customEnforcerMiddleware middleware
// whith a control function tmpFunctionEnforce that define the control string
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

### Example 1 — Custom Access Denied Page

```js
import responseinterceptor from 'responseinterceptor';
import keycloakMiddleware from 'keycloak-express-middleware';


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
    keycloakMiddleware.protectMiddleware('role'),
    (req, res) => {
        res.render('welcome');
    }
);
```

### Example 2 — Redirect to a Dedicated Page (Dynamic Redirect)

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
    keycloakMiddleware.protectMiddleware('none'),
    (req, res) => {
        res.render('welcome');
    }
);
```

### Example 3 — Static Redirect to a Route

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
    keycloakMiddleware.protectMiddleware('none'),
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


## 🧩 Configuration
In your Express application:
```js
const keycloackAdapter = require('keycloak-express-middleware');

// Configure and Initialize Keycloak adapter
const keycloakInstance = new keycloackAdapter(app,{
        "realm": "Realm-Project",
        "auth-server-url": "https://YourKeycloakUrl:30040/",
        "ssl-required": "external",
        "resource": "keycloackclientName",
        "credentials": {
            "secret": "aaaaaaaaaa"
        },
        "confidential-port": 0
    },
    {
        session:{
            secret: 'mySecretForSession',
        }
    })
```
`keycloak-express-middleware constructor` instantiate and configure the object for the Keycloak 
adapter in an Express application. It must be called at app startup, before defining any protected routes.
It is an async function and returns a promise

**` -- @parameters -- `**
- **app**: `[required]` Express application instance (e.g., const app = express();) or express router (e.g., var router = express.Router();)
- **keyCloakConfig:** `[required]`JSON object containing the Keycloak client configuration.  This can be obtained from the Keycloak admin console: Clients → [client name] → Installation → "Keycloak OIDC JSON" → Download. It accepts other parameter not defined in downloaded config like:
  - "verifyTokenAudience": If verify-token-audience = true, the adapter rejects the token if its audience does not match the client that receives it.
  - "bearerOnly": for public client. if it is set to true the client cannot call login services
  Example:   
```json
         
{
    "realm": "realm-name",
    "auth-server-url": "https://keycloak.example.com/",
    "ssl-required": "external",
    "resource": "client-name",
    "credentials": { "secret": "secret-code" },
    "confidential-port": 0
}
  
```
- **keyCloakOptions**: `[required]` advanced configuration options for the adapter. Main supported options:
  - **session:** Express session configuration (as in express-session)
  - **scope:** authentication scopes (e.g., 'openid profile email offline_access') **Note:** to use offline_access, the client must have the option enabled and the user must have the offline_access role.
  - **idpHint:** to suggest an identity provider to Keycloak during login
  - **cookies:** to enable cookie handling
  - **realmUrl:** to override the realm URL
---
## 🔧 Available Middlewares
### `underKeycloakProtection(callback) - deprecated - ` 
**@deprecated Method**. Use the `configure` Method with **`await keycloakAdapter.configure({..})`**, then define your resources as you normally would in Express:
```js
    await keycloakAdapter.configure(config_Parameters);
    
    // Define all your routes here

    app.get('/my-route', handler);
```
Alternatively, if you prefer to define your resources inside a container after configuration, you can use the `then` syntax:
```js
    keycloakAdapter.configure(configParameters).then(() => {
        // Define all your routes to protect here
        app.get('/my-route', handler);
    });
```
This Method is deprecated and will be removed in future versions. It must be called **after** Keycloak has been configured with `configure()`.
The routes declared inside the provided callback will be protected and will have access to authentication/authorization features managed by Keycloak.

📌 Public (unprotected) routes should be declared **before** calling this method. 

**` -- @parameters -- `** 
- **{Function} callback:** `[required]` A function that defines all routes to be protected. It must contain exclusively routes requiring authentication.

✅ Usage example:
```js
// Public route not protected by Keycloak
app.get('/public', (req, res) => {
res.send('Public content');
});

// Section of routes protected by Keycloak
keycloakAdapter.underKeycloakProtection(() => {

    // This function is deprecated and will be removed in future versions. 
    // It is retained only for backward compatibility with older versions
    
    // Route protected by authentication
    app.get('/confidential', keycloakAdapter.protectMiddleware(), (req, res) => {
        res.send('Confidential content visible only to authenticated users');
    });

    // Route with forced login: handled directly by middleware
    app.get('/loginMiddleware', keycloakAdapter.loginMiddleware("/home"), (req, res) => {
        // This response will never be sent because the middleware handles the 
        // request directly
    });
});
```
---
### `protectMiddleware([conditions])`
Middleware to protect Express routes based on authentication and, optionally, authorization via Keycloak roles. 
Allows restricting access to a resource only to authenticated users or to those possessing specific roles in the realm or in a Keycloak client.

**` -- @parameters -- `**
- **conditions**: `[optional]` A String specifing one role, or an array of strings each specifying one or more required roles; or a function executing custom code performing an access role verification 
  - As a string: specifies one required role, using the syntax:
    - 'role'              → client role in the configured client (e.g., 'admin')
    - 'clientid:role'     → client role of a specific client (e.g., 'myclient:editor')
    - 'realm:role'        → realm role (e.g., 'realm:superuser')
  - As array of strings: specifies one or more required roles, using the syntax: 
    - 'role'              → client role in the configured client (e.g., 'admin')
    - 'clientid:role'     → client role of a specific client (e.g., 'myclient:editor')
    - 'realm:role'        → realm role (e.g., 'realm:superuser')
  - As a function: receives (token, req) and must return true or false synchronously. This function enables custom authorization logic. The `token` object passed to the authorization function exposes methods such as:
    - token.hasRole('admin')               // client role in configured client
    - token.hasRole('realm:superuser')     // realm role
    - token.hasRealmRole('superuser)       // realm role like token.hasRole('realm:superuser')
    - token.hasRole('my-client:editor')    // client role of a specific client
    - token.hasResourceRole('editor', 'my-client-id') // equivalent to hasRole('my-client:editor')
    The authorization function must be synchronous and return true (allow access) or false (deny access).

**` -- @returns -- `**  It return a function as an Express middleware to protect the route.

✅ Usage example:
```js

// Authentication only, no role check
app.get('/admin', keycloakAdapter.protectMiddleware(), (req, res) => {
    res.send('Only authenticated users can see this resource.');
});

// Check on client role of configured client (e.g., 'admin')
app.get('/admin', keycloakAdapter.protectMiddleware('admin'), (req, res) => {
    res.send('Only users with the admin client role can access.');
});

// Check on role of a specific client (e.g., client 'clientid', role 'admin')
app.get('/admin', keycloakAdapter.protectMiddleware('clientid:admin'), (req, res) => {
    res.send('Only users with admin role in client "clientid" can access.');
});

// Check on realm role (e.g., 'superuser' role at realm level)
app.get('/admin', keycloakAdapter.protectMiddleware('realm:superuser'), (req, res) => {
    res.send('Only users with realm superuser role can access.');
});

// Custom synchronous authorization function
app.get('/custom', keycloakAdapter.protectMiddleware((token, req) => {
    // Allow only if user has realm role 'editor'
    // and the request has a specific custom header
    return token.hasRealmRole('editor') && req.headers['x-custom-header'] === 'OK';
}), (req, res) => {
    res.send('Access granted by custom authorization function.');
});
```
---
### `customProtectMiddleware(fn)`
Middleware similar to `protectMiddleware` but with dynamic role checking via a function.
Unlike `protectMiddleware`, which accepts a string expressing the role or a control function
that works on the token, this middleware accepts a function that receives the Express
request and response objects `req` and `res` and must return a string representing the role control string.

This is useful for parametric resources where the role control string must be dynamically generated based on the request,
for example, based on URL parameters or query strings.

**Note:** this function **does not** access or parse the token, nor performs any checks other than the role,
so it cannot be used for complex logic depending on request properties other than the role (e.g., client IP, custom headers, etc.).
The function's sole task is to generate the role control string.

**` -- @parameters -- `**
- **fn:** `[required]` Custom function that receives (req, res) and returns a string with the role control string to pass to Keycloak.

✅ Usage example:
```js

app.get('/custom/:id', keycloakAdapter.customProtectMiddleware((req) => {
    // Dynamically builds the client role based on URL parameter 'id'
    return `clientRole${req.params.id}`;
}), (req, res) => {
    res.send(`Access granted to users with role 'clientRole${req.params.id}'`);
});
```
---
### `enforcerMiddleware(conditions, options)`
`enforcerMiddleware` is a middleware to enable permission checks based on resources and policies
defined in Keycloak Authorization Services (UMA 2.0-based).

Unlike `protectMiddleware` and similar, which only verify authentication or roles,
`enforcerMiddleware` allows checking if the user has permission to access
a specific protected resource through flexible and dynamic policies.

Useful in contexts where resources are registered in Keycloak (such as documents, instances, dynamic entities) and
protected by flexible policies.

**` -- @parameters -- `**
- **conditions:** a check control string or function
  - ***As a string or array of strings:*** contain the name of the resource or permission to check. String Examples:
    - ui-admin-resource: Apply the policies associated to the `ui-admin-resource` resource 
    - ui-admin-resource:write: Apply the policies associateo to `ui-admin-resource`resource and `write` scope
  - ***as a function:*** custom check function with signature:
    ***`function(token, req, callback)`***
      - token: decoded Keycloak token
      - req: Express request
      - callback(boolean): invoke with true if authorized, false otherwise 
- **options:**: parameter provided as a JSON object that accepts the following filter:
  - response_mode: 'permissions' (default) or 'token'
  - claims: object with claim info for dynamic policies (e.g. owner id matching)
  - resource_server_id: resource client id (default: current client)

--- How it works ---
- If conditions is a function, it is used for custom checks with callback.
- If conditions is a string, `keycloak.enforcer(conditions, options)` is used for the check.

--- response_mode modes ---
1) 'permissions' (default)
    - Keycloak returns the list of granted permissions (no new token)
    - Permissions available in `req.permissions`

2) 'token'
    - Keycloak issues a new access token containing the granted permissions
    - Permissions available in `req.kauth.grant.access_token.content.authorization.permissions`
    - Useful for apps with sessions and decision caching

--- Keycloak requirements ---

The client must have:
- Authorization Enabled = ON
- Policy Enforcement Mode = Enforcing
- Add permissions to access token = ON

You must also configure in Keycloak:
- Resources
- Policies (e.g., role, owner, JS script)
- Permissions (associate policies to resources)

✅ Usage example:
```js

// Check with static string
app.get('/onlyAdminroute', keycloakAdapter.enforcerMiddleware('ui-admin-resource'), (req, res) => {
    res.send('You are an authorized admin for this resource');
});

app.get('/onlyAdminrouteByScope', keycloakAdapter.enforcerMiddleware('ui-admin-resource:write'), (req, res) => {
    res.send('You are an authorized admin for this resource');
});

// Check with custom function (async with callback)
app.get('/onlyAdminrouteByfunction', keycloakAdapter.enforcerMiddleware(function(token, req, callback) {
    token.hasPermission('ui-admin-resource', function(permission) {
        if (permission) callback(true);
        else {
            token.hasPermission('ui-viewer-resource', function(permission) {
                callback(permission ? true : false);
            });
        }
    });
}), (req, res) => {
    res.send('You are an authorized admin or viewer (custom check)');
});
```
---
### `customEnforcerMiddleware(fn, options)`
`customEnforcerMiddleware` is a middleware for permission checks based on resources and policies
defined in Keycloak Authorization Services (UMA 2.0), using dynamic permission strings.

This middleware is similar to `enforcerMiddleware`, but takes a function
`customFunction(req, res)` as a parameter, which must dynamically return
the permission/resource string to be checked.

**` -- @parameters -- `**
- **fn:**`[required]` custom function that receives `req` and `res` and returns the control string for Keycloak.
    As example:
    ```js
    function customFunction(req, res) {
        // Your function logic
        return req.params.permission;
    }
    ```

- **options:** `[optional]` Additional options passed to `keycloak.enforcer()`, including:
  - **response_mode:** 'permissions' (default) or 'token'
  - **claims:** object with claim info for dynamic policies (e.g., owner ID)
  - **resource_server_id:** string representing the resource client ID (default: current client)

--- response_mode options ---
1) 'permissions' (default)
    - The server returns only the list of granted permissions (no new token)
    - Permissions available in `req.permissions`

2) 'token'
    - The server issues a new access token with granted permissions
    - Permissions available in `req.kauth.grant.access_token.content.authorization.permissions`
    - Useful for decision caching, session handling, automatic token refresh

--- Keycloak Requirements ---

The client must be configured with:
- Authorization Enabled = ON
- Policy Enforcement Mode = Enforcing
- Add permissions to access token = ON

You must also have created:
- Resources
- Policies (e.g., role, owner, JS rules)
- Permissions (linking policies to resources)

✅ Usage example:
```js

const tmpFunctionEnforce = function(req, res) {
    return req.params.permission; // dynamic permission from URL parameter
};

app.get('/onlyAdminrouteByfunction/:permission', keycloakAdapter.customEnforcerMiddleware(tmpFunctionEnforce), (req, res) => {
    console.log("token permissions:", req.permissions);    
    res.send('You are an authorized user with dynamic permission: ' + req.params.permission);
});

```
---
### `encodeTokenRole()`
`encodeTokenRole` is a middleware that decodes the Keycloak token and adds it
to the Express request as `req.encodedTokenRole`.

Unlike `protectMiddleware` or `customProtectMiddleware`, this middleware
does NOT perform any role or authentication checks, but simply extracts
and makes the decoded token available within the route handler function.

It is especially useful when you want to perform custom logic based on roles
or other information contained in the token directly in the route handler,
for example showing different content based on role.

--- Contents of `req.encodedTokenRole` ---

Represents the decoded Keycloak token and exposes several useful methods such as:
- token.hasRole('admin')             // true/false if it has client role "admin"
- token.hasRole('realm:superuser')   // true/false if it has realm role "superuser"
- token.hasRealmRole('superuser)     // realm role like token.hasRole('realm:superuser')
- token.hasRole('my-client:editor')  // true/false if it has client role "editor" for client "my-client"
- token.hasResourceRole('editor', 'my-client-id') // identical to hasRole('my-client:editor')

✅ Usage example:
```js

app.get('/encodeToken', keycloakAdapter.encodeTokenRole(), (req, res) => {
    if (req.encodedTokenRole.hasRole('realm:admin')) {
        res.send("User with admin (realm) role in encodeToken");
    } else {
        res.send("Regular user in encodeToken");
    }
});

```
---
### `encodeTokenPermission()`
`encodeTokenPermission` ia s Middleware whose sole purpose is to decode the access token present in the request
and add to the `req` object a property called `encodedTokenPermission` containing the token's permissions.

Unlike `enforcerMiddleware` and `customEnforcerMiddleware`, it **does not perform any access**
or authorization checks, but exposes a useful method (`hasPermission`) for checking permissions
within the route handler.

It is particularly useful when:
- you want to **customize the response** based on the user's permissions (e.g., show a different page),
- you want to **manually handle access** or perform custom checks on multiple permissions,
- you do not want to block access upfront but decide dynamically within the route handler.

--- Additions to `req` ---

After applying the middleware, `req` contains the property **`encodedTokenPermission`** as an object exposing the method:
- hasPermission(permission: string, callback: function(boolean)) :Checks whether the token contains the specified permission. The callback receives `true` if the permission is present, `false` otherwise.

✅ Usage example:
```js

app.get('/encodeTokenPermission',
    keycloakAdapter.encodeTokenPermission(),
    (req, res) => {
        req.encodedTokenPermission.hasPermission('ui-admin-resource', function(perm) {
            if (perm)
                res.send('You are an authorized admin user by function permission parameters');
            else
                res.status(403).send('Access Denied by encodeTokenPermission');
        });
    });

```
---
### `loginMiddleware(redirectTo)`
`loginMiddleware` is a Middleware used to **force user authentication** via Keycloak.

It is particularly useful when you want to: 
- ensure the user is authenticated,
- redirect the user to a specific page after login or when access is denied,
- integrate automatic login flows on routes that don’t require direct authorization,
    but where login should still be enforced (e.g., profile page, personal area, etc.).

--- Behavior ---
1. If the user is **not authenticated**, Keycloak redirects them to the login flow.
2. If authentication fails or is denied, the user is redirected according to Keycloak's configured settings.
3. If authentication is successful, the user is redirected to 'redirectTo' (usually `/home`, `/dashboard`, etc.).

**` -- @parameters -- `**
- **redirectTo**: `[required]` URL to redirect the user to after login.

--- Warning ---

The route handler callback is **never executed**, because the middleware will respond earlier
with a redirect or block the request.

✅ Usage example:
```js

app.get('/loginMiddleware', keycloakAdapter.loginMiddleware("/home"), (req, res) => {
        // This section is never reached
        res.send("If you see this message, something went wrong.");
});

```
---
### `logoutMiddleware(redirectTo)`
`logoutMiddleware` Middleware is used to **force user logout**, removing the local session
and redirecting the user to Keycloak's logout endpoint according to its configuration.

It is useful when:
- You want to completely log out the user,
- You want to **terminate the session on Keycloak** (not just locally),
- You want to redirect the user to a public page, such as a homepage, after logout.

--- Behavior ---
1. Retrieves the `id_token` of the authenticated user.
2. Constructs the Keycloak logout URL including the token and the redirect URL.
3. **Destroys the local Express session** (e.g., cookies, user data).
4. Redirects the user to the Keycloak logout URL, which in turn redirects to the provided URL.

**` -- @parameters -- `**
- **redirectTo**: `[required]` URL to which the user will be redirected after complete logout.

✅ Usage example:
```js

app.get('/logoutMiddleware', keycloakAdapter.logoutMiddleware("http://localhost:3001/home"),  (req, res) => {
        // This section is never reached
        // The middleware handles logout and redirection automatically
    });

```
--- Note ---
- The middleware **never executes the route callback**, as it fully handles the response.
- The `redirectTo` parameter must match a **valid redirect URI** configured in Keycloak for the client.

--- Requirements ---
- The Keycloak client must have properly configured `Valid Redirect URIs`.
- The Express session must be active (e.g., `express-session` properly initialized).


## 🔧 Available Functions
### `login(req, res, redirectTo)`
`login` Function not a middleware, but a **classic synchronous function** that forces user authentication
via Keycloak and, if the user is not authenticated, redirects them to the login page.
After successful login, the user is redirected to the URL specified in the `redirectTo` parameter.

--- Differences from `loginMiddleware` ---
- `loginMiddleware` handles everything automatically **before** the route handler function.
- `login` instead is a function **that can be manually called inside the route handler**,
  offering **greater control** over when and how login is enforced.

**` -- @parameters -- `**
- **req:** `[required]` Express `Request` object
- **res:** `[required]` Express `Response` object
- **redirectTo:** `[required]` URL to redirect the user to after successful login

--- Behavior ---
1. Attempts to protect the request using `keycloak.protect()`.
2. If the user **is authenticated**, it performs `res.redirect(redirectTo)`.
3. If **not authenticated**, Keycloak automatically handles redirection to the login page.

✅ Usage example:
```js

app.get('/login', (req, res) => {
    // Your route logic
    // ...
    // Force authentication if necessary
    keycloakAdapter.login(req, res, "/home");
});

```

--- Notes ---
- The function can be called **within an Express route**, allowing for custom conditional logic.
- Useful for scenarios where only certain conditions should trigger a login.

--- Requirements ---
- `Valid Redirect URIs` must include the URL passed to `redirectTo`.
---
### `logout(req, res, redirectTo)`
`logout` Function is not a middleware, but a **classic synchronous function** that forces the user to logout
via Keycloak. In addition to terminating the current session (if any), it generates the Keycloak
logout URL and redirects the user's browser to that address.

--- Differences from `logoutMiddleware` ---
- `logoutMiddleware` is designed to be used directly as middleware in the route definition.
- `logout` instead is a function **to be called inside the route**, useful for handling logout
  **conditionally** or within more complex logic.

**` -- @parameters -- `**
- **req:** `[required]` Express `Request` object
- **res:** `[required]` Express `Response` object
- **redirectTo:** `[required]` URL to redirect the user to after successful logout


--- Behavior ---
1. Retrieves the `id_token` from the current user's Keycloak token (if present).
2. Builds the logout URL using `keycloak.logoutUrl()`.
3. Destroys the user's Express session.
4. Redirects the user to the Keycloak logout URL, which in turn redirects to `redirectTo`.

✅ Usage example:
```js

app.get('/logout', (req, res) => {
    // Any custom logic before logout
    // ...
    keycloakAdapter.logout(req, res, "http://localhost:3001/home");
});

```

--- Requirements ---
- The user must be authenticated with Keycloak and have a valid token in `req.kauth.grant`.
- The URL specified in `redirectTo` must be present in the `Valid Redirect URIs` in the Keycloak client.

---

### `redirectToUserAccountConsole(res)`
`redirectToUserAccountConsole` Function is not a middleware, but a **classic synchronous function** that redirect
the users to keycloak Admin console where they can view and manage their personal profile and account settings.

**` -- @parameters -- `**
- **res:** `[required]` Express `Response` object



--- Design suggestions ---
The most common and simplest solution:
On your app’s page, add a custom link that opens a new tab directing the user to their personal account management page. 
This way, the app page remains open, and the user can easily return to it after navigating to the tab or window containing their personal account.

Example:
Suppose that https://auth.example.com/user/account is the endpoint used by the redirectToUserAccountConsole function
here’s a possible example:
✅ Usage example:
```html
<a href="https://auth.example.com/user/account/console" target="_blank">
  Manage my profile
</a>
```

```js

app.get('/user/account/console', (req, res) => {
    // Any custom logic before logout
    keycloakAdapter.redirectToUserAccountConsole(res);
});

```

The user opens the account console in a new tab, uses it, and then manually returns to your app.
✅ Simple, no special configuration required.

---

--- Requirements ---
- The user must be authenticated with Keycloak and have a valid token in `req.kauth.grant`.
- The URL specified in `redirectTo` must be present in the `Valid Redirect URIs` in the Keycloak client.

---

## 📝 License

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

## 🙋‍♂️ Contributions

Contributions, issues and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

---

## 👨‍💻 Maintainer

Developed and maintained by [CRS4 Microservice Core Team ([cmc.smartenv@crs4.it](mailto:cmc.smartenv@crs4.it))] – feel free to reach out for questions or suggestions.

Design and development
------
Alessandro Romanino ([a.romanino@gmail.com](mailto:a.romanino@gmail.com))<br>
Guido Porruvecchio ([guido.porruvecchio@gmail.com](mailto:guido.porruvecchio@gmail.com))


