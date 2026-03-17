var Keycloak =require('keycloak-connect');
var session=require('express-session');
const crypto = require('crypto');



class keycloakExpressMiddleware {

    /**
     * Express/Keycloak adapter class exposing middleware factories,
     * imperative login/logout helpers, and OIDC token endpoint helpers.
     */

    /**
     * Initialize middleware instance bound to an Express app.
     *
     * @param {Object} app - Express application instance.
     * @param {Object} keycloakConfig - Keycloak client configuration (keycloak.json shape).
     * @param {Object} [keycloakOptions] - Advanced adapter options (session, scope, idpHint, cookies, realmUrl, clientId, clientSecret).
     */

    constructor(app, keycloakConfig, keycloakOptions = {}) {
        this.keycloak = null;
        this.ready=false;
        this.readyQueue=[];
        this.realmName=keycloakConfig.realm || keycloakOptions.realmName;
        this.authServerUrl=keycloakConfig['auth-server-url'];
        // Store OIDC configuration for token endpoint helpers.
        this.clientId=keycloakConfig.resource || keycloakOptions.clientId;
        this.clientSecret=keycloakConfig.credentials?.secret || keycloakOptions.clientSecret;
        if (keycloakOptions.session){
                const memoryStore = new session.MemoryStore();
                app.use(
                    session({
                        secret: keycloakOptions.session.secret || 'mySecret',
                        resave: keycloakOptions.session.resave || false,
                        saveUninitialized: keycloakOptions.session.saveUninitialized || true,
                        store: memoryStore,
                    })
                );
                keycloakOptions.store=memoryStore;
        }

        this.keycloak = new Keycloak(keycloakOptions,keycloakConfig);

        app.use(this.keycloak.middleware());
        this.readyQueue.forEach(function(clb){
            clb();
        });
        this.ready=true;
        this.readyQueue=[];

    }




    

    /**
     * ***************************** - ENGLISH - *******************************
     * @deprecated Declare routes directly after creating the middleware instance.
     *
     * Example:
     *
    *     const keycloakAdapter = new keycloakExpressMiddleware(app, keycloakConfig, keycloakOptions);
     *     app.get('/my-route', keycloakAdapter.protectMiddleware(), handler);
     *
     * This helper is kept for backward compatibility and may be removed in a future major release.
     *
     * Method to define Express routes that must be protected by Keycloak.
     *
     * The callback is executed when the middleware is ready. In the current constructor-based
     * initialization flow this is immediate, so direct route declaration is preferred.
     *
     * Public (unprotected) routes should be declared before protected ones.
     *
     * @param {Function} callback - A function that defines routes requiring authentication.
     */
    underKeycloakProtection(callback){
        if(this.ready){
            callback();
        }else{
            this.readyQueue.push(callback);
        }
    }


    
    /**
     * ***************************** - ENGLISH - *******************************
     * Middleware to protect Express routes based on authentication and, optionally,
     * authorization via Keycloak roles.
     *
     * Allows restricting access to a resource only to authenticated users or
     * to those possessing specific roles in the realm or in a Keycloak client.
     *
     * @param {string|function} [conditions] -
     *   - If a string, specifies one or more required roles, using the syntax:
     *       - 'role'              → client role in the configured client (e.g., 'admin')
     *       - 'clientid:role'     → client role of a specific client (e.g., 'myclient:editor')
     *       - 'realm:role'        → realm role (e.g., 'realm:superuser')
     *   - If a function, receives (token, req) and must return true or false synchronously.
     *     This function enables custom authorization logic.
     *
     * @returns {Function} Express middleware to protect the route.
     *
     * --- Usage examples ---
     *
     * // Authentication only, no role check
     * app.get('/admin', keycloakAdapter.protectMiddleware(), (req, res) => {
     *     res.send('Only authenticated users can see this resource.');
     * });
     *
     * // Check on client role of configured client (e.g., 'admin')
     * app.get('/admin', keycloakAdapter.protectMiddleware('admin'), (req, res) => {
     *     res.send('Only users with the admin client role can access.');
     * });
     *
     * // Check on role of a specific client (e.g., client 'clientid', role 'admin')
     * app.get('/admin', keycloakAdapter.protectMiddleware('clientid:admin'), (req, res) => {
     *     res.send('Only users with admin role in client "clientid" can access.');
     * });
     *
     * // Check on realm role (e.g., 'superuser' role at realm level)
     * app.get('/admin', keycloakAdapter.protectMiddleware('realm:superuser'), (req, res) => {
     *     res.send('Only users with realm superuser role can access.');
     * });
     *
     * // Custom synchronous authorization function
     * app.get('/custom', keycloakAdapter.protectMiddleware((token, req) => {
     *     // Allow only if user has realm role 'editor'
     *     // and the request has a specific custom header
     *     return token.hasRealmRole('editor') && req.headers['x-custom-header'] === 'OK';
     * }), (req, res) => {
     *     res.send('Access granted by custom authorization function.');
     * });
     *
     * --- Accessing token data in the route handler ---
     *
     * After successful authentication, the token and its information are available at:
     * - `req.kauth.grant.access_token.content` - decoded token content
     *   - `req.kauth.grant.access_token.content.scope` - granted scopes (e.g., 'openid profile email')
     *   - `req.kauth.grant.access_token.content.preferred_username` - user's username
     *   - `req.kauth.grant.access_token.content.email` - user's email
     *   - `req.kauth.grant.access_token.content.name` - user's full name
     *   - `req.kauth.grant.access_token.content.resource_access` - roles per specific client
     *   - `req.kauth.grant.access_token.content.realm_access` - realm roles
     *   - Any other custom token claims
     *
     * ⭐ Example: Admin resource with scope verification in route handler
     * Protects the route requiring 'admin' role.
     * In the handler, verifies that the user also has the 'email' scope:
     *
     * app.get('/admin/users', keycloakAdapter.protectMiddleware('admin'), (req, res) => {
     *     // Access authenticated token data
     *     const tokenContent = req.kauth.grant.access_token.content;
     *     const userScopes = tokenContent.scope || ''; // e.g., 'openid profile email'
     *     const username = tokenContent.preferred_username;
     *     const userEmail = tokenContent.email;
     *
     *     // Custom scope verification in the handler
     *     if (!userScopes.includes('email')) {
     *         return res.status(403).json({
     *             error: 'Forbidden',
     *             message: 'The user does not have the email scope required for this operation.'
     *         });
     *     }
     *
     *     // If all checks pass, proceed
     *     res.json({
     *         message: 'Welcome admin!',
     *         username: username,
     *         email: userEmail,
     *         scopes: userScopes.split(' ')
     *     });
     * });
     *
     * --- Token details and useful methods ---
     *
     * The `token` object passed to the authorization function exposes methods such as:
     * - token.hasRole('admin')               // client role in configured client
     * - token.hasRole('realm:superuser')     // realm role
     * - token.hasRole('my-client:editor')    // client role of a specific client
     * - token.hasResourceRole('editor', 'my-client-id') // equivalent to hasRole('my-client:editor')
     *
     * The authorization function must be synchronous and return true (allow access)
     * or false (deny access).
     */

    // protectMiddleware(conditions){
    //     //return(this.keycloak.protect(conditions));
    //
    //     const self = this;
    //     return function(req, res, next){
    //         conditions = Array.isArray(conditions) ? conditions : [conditions];
    //         self.keycloak.protect((token) => {
    //             return conditions.some((role) => typeof role === 'string' && token.hasRole(role));
    //         })(req, res, next);
    //     }
    // }
    protectMiddleware(conditions) {
        // If conditions is a function, delegate directly to keycloak.protect()
        if (typeof conditions === 'function') {
            return this.keycloak.protect(conditions);
        }

        // If conditions is null/undefined/not provided, delegate to keycloak.protect() without args
        if (conditions === null || conditions === undefined) {
            return this.keycloak.protect();
        }

        // Otherwise, handle single or multiple role strings.
        return (req, res, next) => {
            const roles = Array.isArray(conditions) ? conditions : [conditions];
            this.keycloak.protect((token) => {
                return roles.some(
                    (role) => typeof role === 'string' && token.hasRole(role)
                );
            })(req, res, next);
        };
    }

    
    /**
     * ***************************** - ENGLISH - *******************************
     * Middleware similar to `protectMiddleware` but with dynamic role checking via a function.
     *
     * Unlike `protectMiddleware`, which accepts a string expressing the role or a control function
     * that works on the token, this middleware accepts a function that receives the Express
     * request and response objects `req` and `res` and must return a string representing the role control string.
     *
     * This is useful for parametric resources where the role control string must be dynamically generated based on the request,
     * for example, based on URL parameters or query strings.
     *
     * Note: this function **does not** access or parse the token, nor performs any checks other than the role,
     * so it cannot be used for complex logic depending on request properties other than the role
     * (e.g., client IP, custom headers, etc.).
     * The function's sole task is to generate the role control string.
     *
     * --- Parameters ---
     * @param {function} customFunction - function that receives (req, res) and returns a string
     *                                    with the role control string to pass to Keycloak.
     *
     * --- Usage example ---
     *
     * app.get('/custom/:id', keycloakAdapter.customProtectMiddleware((req) => {
     *     // Dynamically builds the client role based on URL parameter 'id'
     *     return `clientRole${req.params.id}`;
     * }), (req, res) => {
     *     res.send(`Access granted to users with role 'clientRole${req.params.id}'`);
     * });
     *
     * --- Internal working ---
     * - Calls the `customFunction` with req, res to obtain the role string.
     * - Passes that string to `keycloak.protect()`.
     * - Returns an Express middleware that enforces Keycloak protection based on that string.
     */

    customProtectMiddleware(customFunction){
        return (req, res, next) => {
            let protectionString=customFunction(req,res);
            this.keycloak.protect(protectionString)(req,res,next);
        };
    }


    

    /**
     * ***************************** - ENGLISH - *******************************
     * `encodeTokenRole` middleware that decodes the Keycloak token and adds it
     * to the Express request as `req.encodedTokenRole`.
     *
     * Unlike `protectMiddleware` or `customProtectMiddleware`, this middleware
     * does NOT perform any role or authentication checks, but simply extracts
     * and makes the decoded token available within the route handler function.
     *
     * It is especially useful when you want to perform custom logic based on roles
     * or other information contained in the token directly in the route handler,
     * for example showing different content based on role.
     *
     * --- Contents of `req.encodedTokenRole` ---
     * Represents the decoded Keycloak token and exposes several useful methods such as:
     * - token.hasRole('admin')             // true/false if it has client role "admin"
     * - token.hasRole('realm:superuser')   // true/false if it has realm role "superuser"
     * - token.hasRole('my-client:editor')  // true/false if it has client role "editor" for client "my-client"
     * - token.hasResourceRole('editor', 'my-client-id') // identical to hasRole('my-client:editor')
     *
     * --- Usage example ---
     *
     * app.get('/encodeToken', keycloakAdapter.encodeTokenRole(), (req, res) => {
     *     if (req.encodedTokenRole.hasRole('realm:admin')) {
     *         res.send("User with admin (realm) role in encodeToken");
     *     } else {
     *         res.send("Regular user in encodeToken");
     *     }
     * });
     *
     * --- Internal working ---
     * Uses `keycloak.protect()` with a callback function that assigns the decoded token
     * to `req.encodedTokenRole` and always allows access.
     *
     * This way it does not block access but makes the token available in the route.
     */

    encodeTokenRole(){
        let getTokenFunction=function(token,req){
            req.encodedTokenRole=token;
            return(true);
        }
        return(this.keycloak.protect(getTokenFunction));
    }



    
    /**
     * ***************************** - ENGLISH - *******************************
     * `enforcerMiddleware` middleware to enable permission checks
     * based on resources and policies defined in Keycloak Authorization Services (UMA 2.0-based).
     *
     * Unlike `protectMiddleware` and similar, which only verify authentication or roles,
     * `enforcerMiddleware` allows checking if the user has permission to access
     * a specific protected resource through flexible and dynamic policies.
     *
     * Useful in contexts where resources are registered in Keycloak (such as documents, instances, dynamic entities) and
     * protected by flexible policies.
     *
     * --- Parameters ---
     * @param {string|function} conditions
     *   - string containing the name of the resource or permission to check
     *   - custom check function with signature:
     *       function(token, req, callback)
     *       - token: decoded Keycloak token
     *       - req: Express request
     *       - callback(boolean): invoke with true if authorized, false otherwise
     *
     * @param {object} [options] (optional)
     *   - response_mode: 'permissions' (default) or 'token'
     *   - claims: object with claim info for dynamic policies (e.g. owner id matching)
     *   - resource_server_id: resource client id (default: current client)
     *
     * --- How it works ---
     * - If conditions is a function, it is used for custom checks with callback.
     * - If conditions is a string, `keycloak.enforcer(conditions, options)` is used for the check.
     *
     * --- response_mode modes ---
     * 1) 'permissions' (default)
     *    - Keycloak returns the list of granted permissions (no new token)
     *    - Permissions available in `req.permissions`
     *
     * 2) 'token'
     *    - Keycloak issues a new access token containing the granted permissions
     *    - Permissions available in `req.kauth.grant.access_token.content.authorization.permissions`
     *    - Useful for apps with sessions and decision caching
     *
     * --- Keycloak requirements ---
     * The client must have:
     * - Authorization Enabled = ON
     * - Policy Enforcement Mode = Enforcing
     * - Add permissions to access token = ON
     *
     * You must also configure in Keycloak:
     * - Resources
     * - Policies (e.g., role, owner, JS script)
     * - Permissions (associate policies to resources)
     *
     * --- Usage examples ---
     *
     * // Check with static string
     * app.get('/onlyAdminroute', keycloakAdapter.enforcerMiddleware('ui-admin-resource'), (req, res) => {
     *    res.send('You are an authorized admin for this resource');
     * });
     *
     * // Check with custom function (async with callback)
     * app.get('/onlyAdminrouteByfunction', keycloakAdapter.enforcerMiddleware(function(token, req, callback) {
     *     token.hasPermission('ui-admin-resource', function(permission) {
     *         if (permission) callback(true);
     *         else {
     *             token.hasPermission('ui-viewer-resource', function(permission) {
     *                 callback(permission ? true : false);
     *             });
     *         }
     *     });
     * }), (req, res) => {
     *    res.send('You are an authorized admin or viewer (custom check)');
     * });
     */

    enforcerMiddleware(conditions,options){
        const self = this;
        if (typeof conditions === 'function') {
            return (function(req, res, next){
                let tokenF=function(permission,callbackPermission){
                    self.#encodeTokenPermissionHandler(permission,req,res,callbackPermission);
                }
                conditions({hasPermission:tokenF},req,function(yesOrNot){
                    if(yesOrNot) next();
                    else {
                        self.keycloak.protect(function (token, req) {
                            return(false);
                        })(req,res,next);
                    }
                });
            })
        }else{
            return(self.keycloak.enforcer(conditions,options));
        }
    }




    
    /**
     * ***************************** - ENGLISH - *******************************
     * `customEnforcerMiddleware` middleware for permission checks based on resources and policies
     * defined in Keycloak Authorization Services (UMA 2.0), using dynamic permission strings.
     *
     * This middleware is similar to `enforcerMiddleware`, but takes a function
     * `customFunction(req, res)` as a parameter, which must dynamically return
     * the permission/resource string to be checked.
     *
     * --- Parameters ---
     * @param {function} customFunction
     *    Function that receives `req` and `res` and returns the control string for Keycloak.
     *    Example:
     *      function(req, res) {
     *        return req.params.permission;
     *      }
     *
     * @param {object} [options] (optional)
     *    Additional options passed to `keycloak.enforcer()`, including:
     *      - response_mode: 'permissions' (default) or 'token'
     *      - claims: object with claim info for dynamic policies (e.g., owner ID)
     *      - resource_server_id: string representing the resource client ID (default: current client)
     *
     * --- response_mode options ---
     * 1) 'permissions' (default)
     *    - The server returns only the list of granted permissions (no new token)
     *    - Permissions available in `req.permissions`
     *
     * 2) 'token'
     *    - The server issues a new access token with granted permissions
     *    - Permissions available in `req.kauth.grant.access_token.content.authorization.permissions`
     *    - Useful for decision caching, session handling, automatic token refresh
     *
     * --- Keycloak Requirements ---
     * The client must be configured with:
     * - Authorization Enabled = ON
     * - Policy Enforcement Mode = Enforcing
     * - Add permissions to access token = ON
     *
     * You must also have created:
     * - Resources
     * - Policies (e.g., role, owner, JS rules)
     * - Permissions (linking policies to resources)
     *
     * --- Usage Example ---
     *
     * const tmpFunctionEnforce = function(req, res) {
     *     return req.params.permission; // dynamic permission from URL parameter
     * };
     *
     * app.get('/onlyAdminrouteByfunction/:permission', keycloakAdapter.customEnforcerMiddleware(tmpFunctionEnforce), (req, res) => {
     *     res.send('You are an authorized user with dynamic permission: ' + req.params.permission);
     * });
     */

    customEnforcerMiddleware(customFunction,options){
        const self = this;
        return function(req, res, next){
            let protectionString=customFunction(req,res);
            self.keycloak.enforcer(protectionString,options)(req,res,next);
        }
    }



    /**
     * Internal permission probe used by `enforcerMiddleware` and `encodeTokenPermission`.
     *
     * It temporarily overrides `res.end` so we can map Keycloak deny/allow behavior
     * to a simple boolean callback without sending extra output.
     *
     * @param {string|string[]} permissions - Permission expression(s) to validate.
     * @param {Object} req - Express request.
     * @param {Object} res - Express response.
     * @param {Function} callback - Receives true when allowed, false otherwise.
     */
    #encodeTokenPermissionHandler(permissions,req,res,callback){
        res.oldEnd=res.end;
        res.end=function(content){
            res.end=res.oldEnd;
            callback(false);
        }
        this.keycloak.enforcer(permissions)(req,res,function(){
            res.end=res.oldEnd;
            callback(true);
        });
    }


    

    /**
     * ***************************** - ENGLISH - *******************************
     * `encodeTokenPermission` Middleware
     *
     * This middleware's sole purpose is to decode the access token present in the request
     * and add to the `req` object a property called `encodedTokenPermission` containing the token's permissions.
     *
     * Unlike `enforcerMiddleware` and `customEnforcerMiddleware`, it **does not perform any access**
     * or authorization checks, but exposes a useful method (`hasPermission`) for checking permissions
     * within the route handler.
     *
     * It is particularly useful when:
     * - you want to **customize the response** based on the user's permissions (e.g., show a different page),
     * - you want to **manually handle access** or perform custom checks on multiple permissions,
     * - you do not want to block access upfront but decide dynamically within the route handler.
     *
     * --- Additions to `req` ---
     * After applying the middleware, `req` contains:
     *
     * @property {Object} req.encodedTokenPermission
     *     An object exposing the method:
     *
     *     - `hasPermission(permission: string, callback: function(boolean))`
     *       Checks whether the token contains the specified permission.
     *       The callback receives `true` if the permission is present, `false` otherwise.
     *
     * --- Usage Example ---
     *
     * ```js
     * app.get('/encodeTokenPermission',
     *     keycloakAdapter.encodeTokenPermission(),
     *     (req, res) => {
     *         req.encodedTokenPermission.hasPermission('ui-admin-resource', function(perm) {
     *             if (perm)
     *                 res.send('You are an authorized admin user by function permission parameters');
     *             else
     *                 res.status(403).send('Access Denied by encodeTokenPermission');
     *         });
     *     });
     * ```
     */

    encodeTokenPermission(){
        const self = this;
        return(function (req,res,next){
            req.encodedTokenPermission={
                "hasPermission":function(permission,callback){
                    self.#encodeTokenPermissionHandler(permission,req,res,callback);
                }
            };
            next();
        });
    }

    
    /**
     * ***************************** - ENGLISH - *******************************
     * `loginMiddleware` Middleware
     *
     * This middleware is used to **force user authentication** via Keycloak.
     *
     * It is particularly useful when you want to:
     * - ensure the user is authenticated,
     * - redirect the user to a specific page after login or when access is denied,
     * - integrate automatic login flows on routes that don’t require direct authorization,
     *   but where login should still be enforced (e.g., profile page, personal area, etc.).
     *
     * --- Behavior ---
     * 1. If the user is **not authenticated**, Keycloak redirects them to the login flow.
     * 2. If authentication fails or is denied, the user is redirected according to Keycloak's configured settings.
     * 3. If authentication is successful, the user is redirected to 'redirectTo' (usually `/home`, `/dashboard`, etc.).
     *
     * --- Parameters ---
     * @param {string} redirectTo - URL to redirect the user to after login.
     *
     * --- Warning ---
     * The route handler callback is **never executed**, because the middleware will respond earlier
     * with a redirect or block the request.
     *
     * --- Usage Example ---
     * ```js
     * app.get('/loginMiddleware',
     *     keycloakAdapter.loginMiddleware("/home"),
     *     (req, res) => {
     *         // This section is never reached
     *         res.send("If you see this message, something went wrong.");
     *     });
     * ```
     *
     * --- Requirements ---
     * Keycloak must be properly configured and connected to the app as middleware.
     */

    loginMiddleware(redirectTo){
        return([this.keycloak.protect(),function(req,res,next){
            res.redirect(redirectTo);
        }]);
    }


    
    /**
     * ***************************** - ENGLISH - *******************************
     * `logoutMiddleware` Middleware
     *
     * This middleware is used to **force user logout**, removing the local session
     * and redirecting the user to Keycloak's logout endpoint according to its configuration.
     *
     * It is useful when:
     * - You want to completely log out the user,
     * - You want to **terminate the session on Keycloak** (not just locally),
     * - You want to redirect the user to a public page, such as a homepage, after logout.
     *
     * --- Behavior ---
     * 1. Retrieves the `id_token` of the authenticated user.
     * 2. Constructs the Keycloak logout URL including the token and the redirect URL.
     * 3. **Destroys the local Express session** (e.g., cookies, user data).
     * 4. Redirects the user to the Keycloak logout URL, which in turn redirects to the provided URL.
     *
     * --- Parameters ---
     * @param {string} redirectTo - URL to which the user will be redirected after complete logout.
     *
     * --- Usage Example ---
     * ```js
     * app.get('/logoutMiddleware',
     *     keycloakAdapter.logoutMiddleware("http://localhost:3001/home"),
     *     (req, res) => {
     *         // This section is never reached
     *         // The middleware handles logout and redirection automatically
     *     });
     * ```
     *
     * --- Note ---
     * - The middleware **never executes the route callback**, as it fully handles the response.
     * - The `redirectTo` parameter must match a **valid redirect URI** configured in Keycloak for the client.
     *
     * --- Requirements ---
     * - The Keycloak client must have properly configured `Valid Redirect URIs`.
     * - The Express session must be active (e.g., `express-session` properly initialized).
     */
    logoutMiddleware(redirectTo){
        const self = this;
        return function(req,res,next){
            const idToken = req.kauth?.grant?.id_token?.token;
            if(idToken) {
                const logoutUrl = self.keycloak.logoutUrl(redirectTo, idToken);
                req.session.destroy(() => {
                    res.redirect(logoutUrl);
                });
            }else res.redirect(redirectTo);
        }
    }


    
    /**
     * ***************************** - ENGLISH - *******************************
     * `login` Function
     *
     * This is not a middleware, but a **classic synchronous function** that forces user authentication
     * via Keycloak and, if the user is not authenticated, redirects them to the login page.
     * After successful login, the user is redirected to the URL specified in the `redirectTo` parameter.
     *
     * --- Differences from `loginMiddleware` ---
     * - `loginMiddleware` handles everything automatically **before** the route handler function.
     * - `login` instead is a function **that can be manually called inside the route handler**,
     *   offering **greater control** over when and how login is enforced.
     *
     * --- Parameters ---
     * @param {Object} req - Express `Request` object
     * @param {Object} res - Express `Response` object
     * @param {string} redirectTo - URL to redirect the user to after successful login
     *
     * --- Behavior ---
     * 1. Attempts to protect the request using `keycloak.protect()`.
     * 2. If the user **is authenticated**, it performs `res.redirect(redirectTo)`.
     * 3. If **not authenticated**, Keycloak automatically handles redirection to the login page.
     *
     * --- Usage Example ---
     * ```js
     * app.get('/login', (req, res) => {
     *     // Your route logic
     *     // ...
     *
     *     // Force authentication if necessary
     *     keycloakAdapter.login(req, res, "/home");
     * });
     * ```
     *
     * --- Notes ---
     * - The function can be called **within an Express route**, allowing for custom conditional logic.
     * - Useful for scenarios where only certain conditions should trigger a login.
     *
     * --- Requirements ---
     * - Keycloak must be properly initialized and integrated with Express.
     * - `Valid Redirect URIs` must include the URL passed to `redirectTo`.
     */

    login(req,res,redirectTo){
        this.keycloak.protect()(req,res,function(){
            res.redirect(redirectTo);
        });
    }


    
    /**
     * ***************************** - ENGLISH - *******************************
     * `logout` Function
     *
     * This is not a middleware, but a **classic synchronous function** that forces the user to logout
     * via Keycloak. In addition to terminating the current session (if any), it generates the Keycloak
     * logout URL and redirects the user's browser to that address.
     *
     * --- Differences from `logoutMiddleware` ---
     * - `logoutMiddleware` is designed to be used directly as middleware in the route definition.
     * - `logout` instead is a function **to be called inside the route**, useful for handling logout
     *   **conditionally** or within more complex logic.
     *
     * --- Parameters ---
     * @param {Object} req - Express `Request` object
     * @param {Object} res - Express `Response` object
     * @param {string} redirectTo - URL to redirect the user after logout
     *
     * --- Behavior ---
     * 1. Retrieves the `id_token` from the current user's Keycloak token (if present).
     * 2. Builds the logout URL using `keycloak.logoutUrl()`.
     * 3. Destroys the user's Express session.
     * 4. Redirects the user to the Keycloak logout URL, which in turn redirects to `redirectTo`.
     *
     * --- Usage Example ---
     * ```js
     * app.get('/logout', (req, res) => {
     *     // Any custom logic before logout
     *     // ...
     *
     *     keycloakAdapter.logout(req, res, "http://localhost:3001/home");
     * });
     * ```
     *
     * --- Requirements ---
     * - The user must be authenticated with Keycloak and have a valid token in `req.kauth.grant`.
     * - The URL specified in `redirectTo` must be present in the `Valid Redirect URIs` in the Keycloak client.
     */

    logout(req,res,redirectTo){
        const idToken = req.kauth?.grant?.id_token?.token;
        if(idToken) {
            const logoutUrl = this.keycloak.logoutUrl(redirectTo,idToken);
            req.session.destroy(() => {
                res.redirect(logoutUrl);
            });
        }else   res.redirect(redirectTo);
    }

    // ===== OIDC Authentication Methods (OAuth2 Token Endpoint Helpers) =====
    
    /**
     * Helper: Base64url encode for PKCE
     * @private
     */
    _base64url(buffer) {
        return buffer
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    /**
     * Generate Authorization URL + PKCE pair for initiating OAuth2 flow
     * 
     * This method generates everything needed to start the PKCE flow:
     * - Authorization URL with code_challenge and state
     * - PKCE code_verifier (to exchange code later)
     * - State parameter (for CSRF protection)
     * 
     * Store state + codeVerifier in session server-side, redirect user to authUrl
     * 
     * @param {Object} options - Configuration options
     * @param {string} options.redirect_uri - Redirect URI (where user returns after login) - REQUIRED
     * @param {string} options.redirectUri - CamelCase alias of redirect_uri
     * @param {string} [options.scope] - Space-separated scopes (default: 'openid profile email')
     * @param {string} [options.state] - Custom state value (auto-generated if not provided)
     * 
     * @returns {Object} PKCE initialization data:
     *   - authUrl: Ready-to-use authorization URL
     *   - state: CSRF token (store in session)
     *   - codeVerifier: PKCE proof (store in session, never expose to client)
     * 
     * @example
     * const pkceFlow = keycloakAdapter.generateAuthorizationUrl({
     *   redirect_uri: 'https://app.example.com/auth/callback'
     * });
     */
    generateAuthorizationUrl(options = {}) {
        if (!this.authServerUrl || !this.realmName || !this.clientId) {
            throw new Error(
                'generateAuthorizationUrl requires middleware to be initialized with ' +
                'valid authServerUrl, realmName, and clientId'
            );
        }

        const { 
            redirect_uri,
            redirectUri,
            scope,
            state: customState
        } = options;

        const resolvedRedirectUri = redirect_uri || redirectUri;
        if (!resolvedRedirectUri) {
            throw new Error(
                'generateAuthorizationUrl requires "redirect_uri" (or "redirectUri")'
            );
        }

        // Generate PKCE pair
        const codeVerifier = this._base64url(crypto.randomBytes(96));
        const codeChallenge = this._base64url(
            crypto.createHash('sha256').update(codeVerifier).digest()
        );

        // Generate or use provided state
        const state = customState || this._base64url(crypto.randomBytes(32));

        // Build authorization URL
        const authUrl = new URL(
            `${this.authServerUrl}realms/${this.realmName}/protocol/openid-connect/auth`
        );
        
        authUrl.searchParams.append('client_id', this.clientId);
        authUrl.searchParams.append('response_type', 'code');
        authUrl.searchParams.append('redirect_uri', resolvedRedirectUri);
        authUrl.searchParams.append('code_challenge', codeChallenge);
        authUrl.searchParams.append('code_challenge_method', 'S256');
        authUrl.searchParams.append('state', state);
        
        if (scope) {
            authUrl.searchParams.append('scope', scope);
        } else {
            authUrl.searchParams.append('scope', 'openid profile email');
        }

        return {
            authUrl: authUrl.toString(),
            state,
            codeVerifier
        };
    }

    /**
     * Exchange credentials for OIDC tokens (generic token endpoint helper)
     * 
     * Supports any OAuth2 grant type:
     * - password: Resource Owner Password Grant (username + password)
     * - client_credentials: Client Credentials Grant
     * - authorization_code: Authorization Code Grant (without PKCE)
     * - refresh_token: Refresh Token Grant
    *
    * Client prerequisite note:
    * - When using `grant_type=password`, Keycloak client must have Direct Access Grants enabled.
    * - This means the client exchanges user username/password directly with Keycloak token endpoint.
    * - In OAuth2 terms, this is Resource Owner Password Credentials Grant support for that client.
    * - This prerequisite does not apply to `client_credentials`, `refresh_token`, or `authorization_code` payloads.
     * 
     * The method automatically appends clientId/clientSecret if configured and not overridden.
     * 
     * @param {Object} credentials - OIDC token request parameters
     * @param {string} credentials.grant_type - OAuth2 grant type (required)
     * @param {string} [credentials.username] - Username (for password grant)
     * @param {string} [credentials.password] - Password (for password grant)
     * @param {string} [credentials.client_id] - Client ID (uses middleware config if not provided)
     * @param {string} [credentials.client_secret] - Client secret (uses middleware config if not provided)
     * @param {string} [credentials.refresh_token] - Refresh token (for refresh_token grant)
     * @param {string} [credentials.code] - Authorization code (for authorization_code grant)
     * @param {string} [credentials.redirect_uri] - Redirect URI (for authorization_code grant)
     * @param {string} [credentials.scope] - OAuth2 scope
     * 
     * @returns {Promise<Object>} Token response from Keycloak
     * @throws {Error} If token request fails
     */
    async loginWithCredentials(credentials = {}) {
        if (!this.authServerUrl || !this.realmName) {
            throw new Error(
                'loginWithCredentials requires middleware to be initialized with valid authServerUrl and realmName'
            );
        }

        const body = new URLSearchParams();
        
        // Add provided credentials
        Object.entries(credentials).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                body.append(key, String(value));
            }
        });

        // Add clientId if not already provided and configured
        if (this.clientId && !body.has('client_id')) {
            body.append('client_id', this.clientId);
        }

        // Add clientSecret if not already provided and configured
        if (this.clientSecret && !body.has('client_secret')) {
            body.append('client_secret', this.clientSecret);
        }

        const tokenUrl = `${this.authServerUrl}realms/${this.realmName}/protocol/openid-connect/token`;

        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            body
        });

        const responseText = await response.text();
        const payload = responseText ? JSON.parse(responseText) : {};

        if (!response.ok) {
            const errorMessage = payload.error_description || payload.error || 'Authentication failed';
            throw new Error(errorMessage);
        }

        return payload;
    }

    /**
     * Exchange authorization code + PKCE verifier for tokens (PKCE callback)
     * 
     * This method is specialized for the callback route after user login.
     * It exchanges the authorization code (from redirect) + code_verifier for tokens.
        *
        * Client prerequisite note:
        * - PKCE uses `authorization_code` + `code_verifier` and does not require Direct Access Grants.
        * - Direct Access Grants is only required when using `grant_type=password` (ROPC) in loginWithCredentials.
     * 
     * @param {Object} credentials - Token exchange parameters
     * @param {string} credentials.code - Authorization code (from Keycloak redirect) - REQUIRED
     * @param {string} credentials.redirect_uri - Redirect URI (must match authorize request) - REQUIRED
     * @param {string} credentials.redirectUri - CamelCase alias of redirect_uri
     * @param {string} credentials.code_verifier - PKCE code verifier (from session) - REQUIRED
     * @param {string} credentials.codeVerifier - CamelCase alias of code_verifier
     * @param {string} [credentials.client_id] - Client ID (uses middleware config if not provided)
     * @param {string} [credentials.clientId] - CamelCase alias of client_id
     * @param {string} [credentials.client_secret] - Client secret (uses middleware config if not provided)
     * @param {string} [credentials.clientSecret] - CamelCase alias of client_secret
     * @param {string} [credentials.scope] - Additional scope string
     * 
      * @returns {Promise<Object>} Token response from Keycloak (same as loginWithCredentials())
     * @throws {Error} If any required parameter is missing or token exchange fails
     */
    async loginPKCE(credentials = {}) {
        const {
            code,
            redirect_uri,
            redirectUri,
            code_verifier,
            codeVerifier,
            client_id,
            clientId,
            client_secret,
            clientSecret,
            ...rest
        } = credentials;

        const resolvedCode = code;
        const resolvedRedirectUri = redirect_uri || redirectUri;
        const resolvedCodeVerifier = code_verifier || codeVerifier;
        const resolvedClientId = client_id || clientId;
        const resolvedClientSecret = client_secret || clientSecret;

        if (!resolvedCode) {
            throw new Error('loginPKCE requires "code".');
        }
        if (!resolvedRedirectUri) {
            throw new Error('loginPKCE requires "redirect_uri" (or "redirectUri").');
        }
        if (!resolvedCodeVerifier) {
            throw new Error('loginPKCE requires "code_verifier" (or "codeVerifier").');
        }

        return this.loginWithCredentials({
            grant_type: 'authorization_code',
            code: resolvedCode,
            redirect_uri: resolvedRedirectUri,
            code_verifier: resolvedCodeVerifier,
            ...(resolvedClientId ? { client_id: resolvedClientId } : {}),
            ...(resolvedClientSecret ? { client_secret: resolvedClientSecret } : {}),
            ...rest
        });
    }

    redirectToUserAccountConsole(res){
        // Use Keycloak account console endpoint for the configured realm.
        let redirectUrl=`${this.authServerUrl}/realms/${this.realmName}/account/`
        res.redirect(redirectUrl);
    }




}


// Main CommonJS export (required for require() to work)
module.exports = keycloakExpressMiddleware;

// Backward compatibility alias - allows: const { keycloackAdapter } = require(...)
// Note: keeping original typo "keycloack" for backward compatibility
module.exports.keycloackAdapter = keycloakExpressMiddleware;

// ES6-style default export simulation
// Allows pattern: const middleware = require(...).default (when needed by some bundlers)
module.exports.default = keycloakExpressMiddleware;

/*
 <table><tbody>
 <tr><th align="left">Alessandro Romanino</th><td><a href="https://github.com/aromanino">GitHub/aromanino</a></td><td><a href="mailto:a.romanino@gmail.com">mailto:a.romanino@gmail.com</a></td></tr>
 <tr><th align="left">Guido Porruvecchio</th><td><a href="https://github.com/gporruvecchio">GitHub/porruvecchio</a></td><td><a href="mailto:guido.porruvecchio@gmail.com">mailto:guido.porruvecchio@gmail.com</a></td></tr>
 </tbody></table>
 * */


