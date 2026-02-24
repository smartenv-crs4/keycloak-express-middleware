var Keycloak =require('keycloak-connect');
var session=require('express-session');
const crypto = require('crypto');



class keycloakExpressMiddleware {

    /**
     * ***************************** - ENGLISH - *******************************
     * Async Configuration function for the Keycloak adapter in an Express application.
     * It must be called at app startup, before defining any protected routes.
     * It returns a promise
     *
     * Parameters:
     * - app: Express application instance (e.g., const app = express();)
     * - keyCloakConfig: JSON object containing the Keycloak client configuration.
     *     This can be obtained from the Keycloak admin console:
     *     Clients → [client name] → Installation → "Keycloak OIDC JSON" → Download
     *     Example:
     *     {
     *       "realm": "realm-name",
     *       "auth-server-url": "https://keycloak.example.com/",
     *       "ssl-required": "external",
     *       "resource": "client-name",
     *       "credentials": { "secret": "secret-code" },
     *       "confidential-port": 0
     *     }
     * - keyCloakOptions: advanced configuration options for the adapter.
     *     Main supported options:
     *     - session: Express session configuration (as in express-session)
     *     - scope: authentication scopes (e.g., 'openid profile email offline_access')
     *         Note: to use offline_access, the client must have the option enabled and
     *         the user must have the offline_access role.
     *     - idpHint: to suggest an identity provider to Keycloak during login
     *     - cookies: to enable cookie handling
     *     - realmUrl: to override the realm URL
     *
     *
     *     Main supported options:
     *     - realmName: [Optional] A String that specifies the realm to authenticate against, if different from the keyCloakConfig.realm parameter.
     *       If you intend to use Keycloak administrator credentials, this should be set to 'master'.
     *     - scope: [Optional] A string that specifies The OAuth2 scope requested during authentication (optional).
     *              Typically not required for administrative clients. example:openid profile
     *    - requestOptions: [Optional] JSON parameters to configure HTTP requests (such as custom headers, timeouts, etc.).
     *      It is compatible with the Fetch API standard. Fetch request options
     *      https://developer.mozilla.org/en-US/docs/Web/API/fetch#options
     *    - username: [Optional] string username. Required when using the password grant type.
     *    - password: [Optional] string password. Required when using the password grant type.
     *    - grantType: The OAuth2 grant type used for authentication.
     *      Possible values: 'password', 'client_credentials', 'refresh_token', etc.
     *    - clientId: string containing the client ID configured in Keycloak. Required for all grant types.
     *    - clientSecret: [Optional] string containing the client secret of the client. Required for client_credentials or confidential clients.
     *    - totp: string for Time-based One-Time Password (TOTP) for multi-factor authentication (MFA), if enabled for the user.
     *    - offlineToken: [Optional] boolean value. If true, requests an offline token (used for long-lived refresh tokens). Default is false.
     *    - refreshToken: [Optional] string containing a valid refresh token to request a new access token when using the refresh_token grant type.
     */

    constructor(app,keyCloackConfig,keyCloackOptions) {
        this.keycloak = null;
        this.ready=false;
        this.readyQueue=[];
        this.realmName=keyCloackConfig.realm || keyCloackOptions.realmName;
        this.authServerUrl=keyCloackConfig['auth-server-url'];
        // Store OIDC configuration for token endpoint helpers (generateAuthorizationUrl, login, loginPKCE)
        this.clientId=keyCloackConfig.resource || keyCloackOptions.clientId;
        this.clientSecret=keyCloackConfig.credentials?.secret || keyCloackOptions.clientSecret;
        if(keyCloackOptions){
            if (keyCloackOptions.session){
                const memoryStore = new session.MemoryStore();
                app.use(
                    session({
                        secret: keyCloackOptions.session.secret || 'mySecret',
                        resave: keyCloackOptions.session.resave || false,
                        saveUninitialized: keyCloackOptions.session.saveUninitialized || true,
                        store: memoryStore,
                    })
                );
                keyCloackOptions.store=memoryStore;
            }
        }else keyCloackOptions={};

        this.keycloak = new Keycloak(keyCloackOptions,keyCloackConfig);

        app.use(this.keycloak.middleware());
        this.readyQueue.forEach(function(clb){
            clb();
        });
        this.ready=true;
        this.readyQueue=[];

    }




    /**
     * *************************** - ITALIANO - *****************************
     * @deprecated Usa la funzione `configure` con `await keycloakAdapter.configure(...)`,
     * poi definisci normalmente le risorse come faresti in Express:
     *
     *     await keycloakAdapter.configure(...);
     *     app.get('/mia-rotta', handler);
     *
     * Oppure, se preferisci definire le risorse all'interno di un blocco dopo la configurazione,
     * puoi usare la sintassi con `then`:
     *
     *     keycloakAdapter.configure(...).then(() => {
     *         // Definizione delle rotte
     *         app.get('/mia-rotta', handler);
     *     });
     *
     * Questa funzione è obsoleta e sarà rimossa in versioni future.
     * Metodo da utilizzare per definire le rotte Express che devono essere protette da Keycloak.
     *
     * Questo metodo deve essere invocato **dopo** aver configurato Keycloak con `configure()`.
     * Le rotte dichiarate all’interno della callback fornita saranno protette e avranno accesso
     * alle funzionalità di autenticazione/autorizzazione gestite da Keycloak.
     *
     * 📌 Le rotte pubbliche (non protette) vanno dichiarate **prima** della chiamata a questo metodo.
     *
     * @param {Function} callback - Una funzione che definisce tutte le rotte da proteggere.
     *                              Deve contenere esclusivamente route che richiedono autenticazione.
     *
     * ✅ Esempio d'uso:
     *
     * // Rotta pubblica non protetta da Keycloak
     * app.get('/public', (req, res) => {
     *     res.send('Public content');
     * });
     *
     * // Sezione di route protette da Keycloak
     * keycloakAdapter.underKeycloakProtection(() => {
     *
     *     // Rotta protetta da autenticazione
     *     app.get('/confidential', keycloakAdapter.protectMiddleware(), (req, res) => {
     *         res.send('Confidential content visible only to authenticated users');
     *     });
     *
     *     // Rotta con login forzato: gestita direttamente dal middleware
     *     app.get('/loginMiddleware', keycloakAdapter.loginMiddleware("/home"), (req, res) => {
     *         // Questa risposta non verrà mai inviata, perché la gestione è effettuata direttamente dal middleware
     *     });
     * });
     */


    /**
     * ***************************** - ENGLISH - *******************************
     * @deprecated Use the `configure` function with `await keycloakAdapter.configure(...)`,
     * then define your resources as you normally would in Express:
     *
     *     await keycloakAdapter.configure(...);
     *     app.get('/my-route', handler);
     *
     * Alternatively, if you prefer to define your resources inside a container after configuration,
     * you can use the `then` syntax:
     *
     *     keycloakAdapter.configure(...).then(() => {
     *         // Define your routes here
     *         app.get('/my-route', handler);
     *     });
     *
     * This function is deprecated and will be removed in future versions.
     *
     * Method to define Express routes that must be protected by Keycloak.
     *
     * This method must be called **after** Keycloak has been configured with `configure()`.
     * The routes declared inside the provided callback will be protected and will have access
     * to authentication/authorization features managed by Keycloak.
     *
     * 📌 Public (unprotected) routes should be declared **before** calling this method.
     *
     * @param {Function} callback - A function that defines all routes to be protected.
     *                              It must contain exclusively routes requiring authentication.
     *
     * ✅ Usage example:
     *
     * // Public route not protected by Keycloak
     * app.get('/public', (req, res) => {
     *     res.send('Public content');
     * });
     *
     * // Section of routes protected by Keycloak
     * keycloakAdapter.underKeycloakProtection(() => {
     *
     *     // Route protected by authentication
     *     app.get('/confidential', keycloakAdapter.protectMiddleware(), (req, res) => {
     *         res.send('Confidential content visible only to authenticated users');
     *     });
     *
     *     // Route with forced login: handled directly by middleware
     *     app.get('/loginMiddleware', keycloakAdapter.loginMiddleware("/home"), (req, res) => {
     *         // This response will never be sent because the middleware handles the request directly
     *     });
     * });
     */
    underKeycloakProtection(callback){
        if(this.ready){
            callback();
        }else{
            this.readyQueue.push(callback);
        }
    }


    /**
     * *************************** - ITALIANO - *****************************
     * Middleware per proteggere le rotte Express basandosi sull'autenticazione e, opzionalmente,
     * sull'autorizzazione tramite ruoli Keycloak.
     *
     * Permette di limitare l'accesso a una risorsa solo agli utenti autenticati oppure
     * a quelli che possiedono ruoli specifici nel realm o in un client Keycloak.
     *
     * @param {string|function} [conditions] -
     *   - Se stringa, specifica uno o più ruoli richiesti, con sintassi:
     *       - 'role'              → ruolo client nel client configurato (es. 'admin')
     *       - 'clientid:role'     → ruolo client specifico di un client (es. 'myclient:editor')
     *       - 'realm:role'        → ruolo di realm (es. 'realm:superuser')
     *   - Se funzione, riceve (token, req) e deve restituire true o false in modo sincrono.
     *     Questa funzione consente una logica di autorizzazione personalizzata.
     *
     * @returns {Function} Middleware Express per la protezione della route.
     *
     * --- Esempi di utilizzo ---
     *
     * // Solo autenticazione senza controllo sui ruoli
     * app.get('/admin', keycloakAdapter.protectMiddleware(), (req, res) => {
     *     res.send('Solo utenti autenticati possono vedere questa risorsa.');
     * });
     *
     * // Controllo su ruolo client del client configurato (es. 'admin')
     * app.get('/admin', keycloakAdapter.protectMiddleware('admin'), (req, res) => {
     *     res.send('Solo utenti con ruolo client admin possono accedere.');
     * });
     *
     * // Controllo su ruolo di un client specifico (es. client 'clientid', ruolo 'admin')
     * app.get('/admin', keycloakAdapter.protectMiddleware('clientid:admin'), (req, res) => {
     *     res.send('Solo utenti con ruolo admin nel client "clientid" possono accedere.');
     * });
     *
     * // Controllo su ruolo di realm (es. ruolo 'superuser' a livello realm)
     * app.get('/admin', keycloakAdapter.protectMiddleware('realm:superuser'), (req, res) => {
     *     res.send('Solo utenti con ruolo realm superuser possono accedere.');
     * });
     *
     * // Funzione di controllo personalizzata (sincrona)
     * app.get('/custom', keycloakAdapter.protectMiddleware((token, req) => {
     *     // Consenti solo se l’utente ha il ruolo realm 'editor'
     *     // e se la richiesta ha header personalizzato specifico
     *     return token.hasRealmRole('editor') && req.headers['x-custom-header'] === 'OK';
     * }), (req, res) => {
     *     res.send('Accesso consentito dalla funzione di controllo personalizzata.');
     * });
     *
     * --- Accesso ai dati del token nella route handler ---
     *
     * Dopo l'autenticazione riuscita, il token e le sue informazioni sono disponibili in:
     * - `req.kauth.grant.access_token.content` - contenuto del token decodificato
     *   - `req.kauth.grant.access_token.content.scope` - gli scope concessi (es. 'openid profile email')
     *   - `req.kauth.grant.access_token.content.preferred_username` - username dell'utente
     *   - `req.kauth.grant.access_token.content.email` - email dell'utente
     *   - `req.kauth.grant.access_token.content.name` - nome completo dell'utente
     *   - `req.kauth.grant.access_token.content.resource_access` - ruoli per client specifici
     *   - `req.kauth.grant.access_token.content.realm_access` - ruoli di realm
     *   - Qualsiasi altro claim personalizzato del token
     *
     * ⭐ Esempio: Risorsa admin con verifica dello scope nella route handler
     * Protegge la route richiedendo il ruolo 'admin'.
     * Nella handler, verifica che l'utente abbia anche lo scope 'email':
     *
     * app.get('/admin/users', keycloakAdapter.protectMiddleware('admin'), (req, res) => {
     *     // Accedi ai dati del token autenticato
     *     const tokenContent = req.kauth.grant.access_token.content;
     *     const userScopes = tokenContent.scope || ''; // es. 'openid profile email'
     *     const username = tokenContent.preferred_username;
     *     const userEmail = tokenContent.email;
     *
     *     // Verifica personalizzata dello scope nella handler
     *     if (!userScopes.includes('email')) {
     *         return res.status(403).json({
     *             error: 'Forbidden',
     *             message: 'L\'utente non ha lo scope email richiesto per questa operazione.'
     *         });
     *     }
     *
     *     // Se tutte le verifiche passano, procedi
     *     res.json({
     *         message: 'Benvenuto admin!',
     *         username: username,
     *         email: userEmail,
     *         scopes: userScopes.split(' ')
     *     });
     * });
     *
     * --- Dettagli sul token e metodi utili ---
     *
     * L'oggetto `token` passato alla funzione di controllo espone metodi come:
     * - token.hasRole('admin')               // ruolo client nel client configurato
     * - token.hasRole('realm:superuser')     // ruolo realm
     * - token.hasRole('my-client:editor')    // ruolo client di un client specifico
     * - token.hasResourceRole('editor', 'my-client-id') // equivalente a hasRole('my-client:editor')
     *
     * La funzione di controllo deve essere sincrona e restituire true (consente l’accesso)
     * o false (nega l’accesso).
     */

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
        // Se conditions è una funzione, delega direttamente a keycloak.protect()
        if (typeof conditions === 'function') {
            return this.keycloak.protect(conditions);
        }

        // Se conditions è null, undefined o non fornito, delega a keycloak.protect() senza parametri
        if (conditions === null || conditions === undefined) {
            return this.keycloak.protect();
        }

        // Altrimenti, gestisci ruoli singoli o multipli
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
     * *************************** - ITALIANO - *****************************
     * Middleware simile a `protectMiddleware` ma con controllo dinamico dei ruoli tramite funzione.
     *
     * A differenza di `protectMiddleware` che accetta una stringa che esprime il ruolo o una funzione di controllo
     * che lavora sul token, questo middleware accetta una funzione che riceve la richiesta e la risposta express
     * `req` e `res`e deve restituire una stringa con la stringa di controllo sul ruolo.
     *
     * È utile per risorse parametriche dove la stringa di controllo sul ruolo va generata dinamicamente in base alla richiesta,
     * ad esempio in base a parametri URL o query string.
     *
     * Nota: questa funzione **non** accede né analizza il token, né fa altri controlli oltre al ruolo,
     * quindi non può essere usata per logiche complesse che dipendono da proprietà della richiesta
     * diverse dal ruolo (es. IP client, header personalizzati, ecc).
     * La funzione ha il solo compito di generare la stringa di controllo
     *
     * --- Parametri ---
     * @param {function} customFunction - funzione che riceve (req, res) e restituisce una stringa
     *                                    con la stringa di controllo ruolo da passare a Keycloak.
     *
     * --- Esempio di utilizzo ---
     *
     * app.get('/custom/:id', keycloakAdapter.customProtectMiddleware((req) => {
     *     // Costruisce dinamicamente il ruolo client in base al parametro URL 'id'
     *     return `clientRole${req.params.id}`;
     * }), (req, res) => {
     *     res.send(`Accesso consentito a chi ha il ruolo 'clientRole${req.params.id}`);
     * });
     *
     * --- Funzionamento interno ---
     * - Richiama la funzione `customFunction` con req, res per ottenere la stringa ruolo.
     * - Passa tale stringa a `keycloak.protect()`.
     * - Restituisce un middleware Express che esegue la protezione Keycloak basata su quella stringa.
     */

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
     * *************************** - ITALIANO - *****************************
     * Middleware `encodeTokenRole` che decodifica il token Keycloak e lo aggiunge
     * alla richiesta Express come `req.encodedTokenRole`.
     *
     * A differenza di `protectMiddleware` o `customProtectMiddleware`, questo middleware
     * NON effettua alcun controllo sui ruoli o sull’autenticazione, ma si limita a estrarre
     * e rendere disponibile il token decodificato all’interno della funzione di gestione
     * della route.
     *
     * È particolarmente utile quando vuoi eseguire logiche personalizzate basate sul ruolo
     * o su altre informazioni contenute nel token direttamente nella route handler,
     * per esempio mostrare contenuti diversi in base al ruolo.
     *
     * --- Contenuto di `req.encodedTokenRole` ---
     * Rappresenta il token decodificato Keycloak e espone vari metodi utili come:
     * - token.hasRole('admin')             // true/false se ha ruolo client "admin"
     * - token.hasRole('realm:superuser')   // true/false se ha ruolo realm "superuser"
     * - token.hasRole('my-client:editor')  // true/false se ha ruolo client "editor" per client "my-client"
     * - token.hasResourceRole('editor', 'my-client-id') // identico a hasRole('my-client:editor')
     *
     * --- Esempio di utilizzo ---
     *
     * app.get('/encodeToken', keycloakAdapter.encodeTokenRole(), (req, res) => {
     *     if (req.encodedTokenRole.hasRole('realm:admin')) {
     *         res.send("Utente con ruolo admin (realm) in encodeToken");
     *     } else {
     *         res.send("Utente normale in encodeToken");
     *     }
     * });
     *
     * --- Funzionamento interno ---
     * Utilizza `keycloak.protect()` con una funzione di callback che assegna il token
     * decodificato a `req.encodedTokenRole` e passa sempre la protezione.
     *
     * In questo modo non blocca l’accesso ma rende disponibile il token nella route.
     */


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
     * *************************** - ITALIANO - *****************************
     * Middleware `enforcerMiddleware` per abilitare il controllo delle autorizzazioni (permissions)
     * basate su risorse e policy definite in Keycloak Authorization Services (basato su UMA 2.0).
     *
     * A differenza di `protectMiddleware` e simili, che verificano solo autenticazione o ruoli,
     * `enforcerMiddleware` consente di verificare se l'utente ha il permesso di accedere
     * a una specifica risorsa protetta tramite policy flessibili e dinamiche.
     *
     * È utile in contesti dove le risorse sono registrate in Keycloak (come documenti, istanze, entità dinamiche) e
     * protette da policy flessibili.
     *
     * --- Parametri ---
     * @param {string|function} conditions
     *   - stringa contenente il nome della risorsa o permesso da controllare
     *   - funzione di controllo personalizzata con firma:
     *       function(token, req, callback)
     *       - token: token Keycloak decodificato
     *       - req: richiesta Express
     *       - callback(boolean): da invocare con true se autorizzato, false altrimenti
     *
     * @param {object} [options] (opzionale)
     *   - response_mode: 'permissions' (default) o 'token'
     *   - claims: object con claim info per policy dinamiche (es. owner id matching)
     *   - resource_server_id: id del client risorsa (default: client corrente)
     *
     * --- Funzionamento ---
     * - Se conditions è funzione, viene usata per effettuare controlli custom con callback.
     * - Se conditions è stringa, si usa `keycloak.enforcer(conditions, options)` per il controllo.
     *
     * --- Modalità response_mode ---
     * 1) 'permissions' (default)
     *    - Keycloak ritorna la lista delle permission concesse (no nuovo token)
     *    - Permissions disponibili in `req.permissions`
     *
     * 2) 'token'
     *    - Keycloak emette un nuovo access token con le permission concesse
     *    - Permissions disponibili in `req.kauth.grant.access_token.content.authorization.permissions`
     *    - Utile per app con sessioni e caching decisioni
     *
     * --- Requisiti lato Keycloak ---
     * Il client deve avere:
     * - Authorization Enabled = ON
     * - Policy Enforcement Mode = Enforcing
     * - Add permissions to access token = ON
     *
     * Inoltre devi aver configurato in Keycloak:
     * - Risorse (Resource)
     * - Policy (es. ruolo, owner, script JS)
     * - Permission (associa policy a risorsa)
     *
     * --- Esempi di utilizzo ---
     *
     * // Controllo con stringa statica
     * app.get('/onlyAdminroute', keycloakAdapter.enforcerMiddleware('ui-admin-resource'), (req, res) => {
     *    res.send('Sei un admin autorizzato per questa risorsa');
     * });
     *
     * // Controllo con funzione custom (asincrona con callback)
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
     *    res.send('Sei admin o viewer autorizzato (controllo custom)');
     * });
     */

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
     * *************************** - ITALIANO - *****************************
     * Middleware `customEnforcerMiddleware` per il controllo delle autorizzazioni basate su risorse e policy
     * definite in Keycloak Authorization Services (UMA 2.0), con stringhe di controllo dinamiche.
     *
     * Questo middleware è simile a `enforcerMiddleware` ma prende come parametro una funzione
     * `customFunction(req, res)` che deve restituire dinamicamente una stringa contenente
     * la stringa di controllo (permission/resource) da verificare.
     *
     * --- Parametri ---
     * @param {function} customFunction
     *    Funzione che riceve `req` e `res` e restituisce la stringa di controllo per Keycloak.
     *    Esempio:
     *      function(req, res) {
     *        return req.params.permission;
     *      }
     *
     * @param {object} [options] (opzionale)
     *    Opzioni aggiuntive passate a `keycloak.enforcer()`, tra cui:
     *      - response_mode: 'permissions' (default) o 'token'
     *      - claims: oggetto con claim info per policy dinamiche (es: owner ID)
     *      - resource_server_id: stringa id client risorsa (default: client corrente)
     *
     * --- Modalità response_mode ---
     * 1) 'permissions' (default)
     *    - Il server restituisce solo la lista di permission concesse (no nuovo token)
     *    - Permissions disponibili in `req.permissions`
     *
     * 2) 'token'
     *    - Il server emette un nuovo access token con le permission concesse
     *    - Permissions disponibili in `req.kauth.grant.access_token.content.authorization.permissions`
     *    - Utile per caching decisioni, gestione sessioni, refresh automatico token
     *
     * --- Requisiti lato Keycloak ---
     * Il client deve essere configurato con:
     * - Authorization Enabled = ON
     * - Policy Enforcement Mode = Enforcing
     * - Add permissions to access token = ON
     *
     * Inoltre devi aver creato:
     * - Risorse (Resource)
     * - Policy (es. ruolo, owner, regole JS)
     * - Permission (associa policy a risorsa)
     *
     * --- Esempio di utilizzo ---
     *
     * const tmpFunctionEnforce = function(req, res) {
     *     return req.params.permission; // permission dinamica da parametro URL
     * };
     *
     * app.get('/onlyAdminrouteByfunction/:permission', keycloakAdapter.customEnforcerMiddleware(tmpFunctionEnforce), (req, res) => {
     *     res.send('Sei un utente autorizzato con permesso dinamico: ' + req.params.permission);
     * });
     *
     */

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
     * *************************** - ITALIANO - *****************************
     * Middleware `encodeTokenPermission`
     *
     * Questo middleware ha il solo compito di decodificare il token di accesso presente nella richiesta
     * e aggiungere alla `req` un oggetto chiamato `encodedTokenPremission`contenete i permessi del token.
     *
     * A differenza di `enforcerMiddleware` e `customEnforcerMiddleware`, **non esegue alcun controllo**
     * sull'accesso o autorizzazione, ma espone un metodo utile (`hasPermission`) per verificare i permessi
     * all'interno del gestore della route.
     *
     * È particolarmente utile nei casi in cui:
     * - si voglia **personalizzare la risposta** in base ai permessi dell'utente (es. mostrare una pagina diversa),
     * - si voglia **gestire manualmente l'accesso** o eseguire controlli personalizzati su più permessi,
     * - non si voglia bloccare l'accesso preventivamente ma decidere dinamicamente nel gestore della risorsa.
     *
     * --- Aggiunte a `req` ---
     * Dopo l'applicazione del middleware, `req` contiene:
     *
     * @property {Object} req.encodedTokenPermission
     *     Un oggetto che espone il metodo:
     *
     *     - `hasPermission(permission: string, callback: function(boolean))`
     *       Verifica se il token possiede il permesso specificato.
     *       La callback riceve `true` se il permesso è presente, `false` altrimenti.
     *
     * --- Esempio di utilizzo ---
     *
     * ```js
     * app.get('/encodeTokenPermission',
     *     keycloakAdapter.encodeTokenPermission(),
     *     (req, res) => {
     *         req.encodedTokenPermission.hasPermission('ui-admin-resource', function(perm) {
     *             if (perm)
     *                 res.send('You are an authorized admin User by function permission parameters');
     *             else
     *                 res.status(403).send('Access Denied by encodeTokenPermission');
     *         });
     *     });
     * ```
     */


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
     * *************************** - ITALIANO - *****************************
     * Middleware `loginMiddleware`
     *
     * Questo middleware viene utilizzato per **forzare l'autenticazione dell'utente** tramite Keycloak.
     *
     * È particolarmente utile nei casi in cui si voglia:
     * - assicurarsi che l'utente sia autenticato,
     * - reindirizzare l'utente ad una pagina specifica dopo il login o in caso di accesso negato,
     * - integrare flussi di autenticazione automatici su rotte che non richiedono direttamente autorizzazione
     * ma dove si vuole comunque forzare la login (es. pagina profilo, area personale, ecc.).
     *
     * --- Comportamento ---
     * 1. Se l’utente **non è autenticato**, Keycloak redirige al suo flusso di login.
     * 2. Se l’autenticazione fallisce o viene rifiutata, l’utente viene reindirizzato secondo le specifiche configurate su keycloak
     * 3. Se autenticato correttamente, viene reindirizzato a 'redirectTo' (di solito `/home`, `/dashboard`, ecc.).
     *
     * --- Parametri ---
     * @param {string} redirectTo - URL verso cui reindirizzare l’utente dopo il login.
     *
     * --- Attenzione ---
     * La funzione di callback associata alla route **non viene mai eseguita**, perché il middleware risponde prima
     * con un redirect o con un blocco.
     *
     * --- Esempio di utilizzo ---
     * ```js
     * app.get('/loginMiddleware',
     *     keycloakAdapter.loginMiddleware("/home"),
     *     (req, res) => {
     *         // Questa sezione non viene mai raggiunta
     *         res.send("Se vedi questo messaggio, qualcosa è andato storto.");
     *     });
     * ```
     *
     * --- Requisiti ---
     * È necessario che Keycloak sia correttamente configurato e collegato all'app come middleware.
     */

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

    loginMiddleware(redirecTo){
        return([this.keycloak.protect(),function(req,res,next){
            res.redirect(redirecTo);
        }]);
    }


    /**
     * *************************** - ITALIANO - *****************************
     * Middleware `logoutMiddleware`
     *
     * Questo middleware viene utilizzato per **forzare il logout dell'utente**, eliminando la sessione locale
     * e redirigendo l'utente al logout di Keycloak secondo le sue configurazioni.
     *
     * È utile nei casi in cui:
     * - Si voglia disconnettere completamente l’utente,
     * - Si desideri **terminare la sessione su Keycloak** (non solo localmente),
     * - Si voglia reindirizzare l’utente ad una pagina pubblica, come una homepage, dopo il logout.
     *
     * --- Comportamento ---
     * 1. Ottiene l'`id_token` dell'utente autenticato.
     * 2. Costruisce l'URL di logout di Keycloak includendo il token e l'URL di redirect.
     * 3. **Distrugge la sessione locale Express** (es. cookie, dati utente).
     * 4. Redirige l'utente all’URL di logout di Keycloak, che a sua volta redirige all'URL fornito.
     *
     * --- Parametri ---
     * @param {string} redirectTo - URL su cui l'utente verrà reindirizzato dopo il logout completo.
     *
     * --- Esempio di utilizzo ---
     * ```js
     * app.get('/logoutMiddleware',
     *     keycloakAdapter.logoutMiddleware("http://localhost:3001/home"),
     *     (req, res) => {
     *         // Questa sezione non viene mai raggiunta
     *         // Il middleware gestisce il logout e il redirect automaticamente
     *     });
     * ```
     *
     * --- Nota ---
     * - Il middleware **non esegue mai la callback della route**, poiché gestisce completamente la risposta.
     * - Il parametro `redirectTo` deve corrispondere a un **valid redirect URI** configurato in Keycloak per il client.
     *
     * --- Requisiti ---
     * - Il client Keycloak deve avere configurato correttamente i `Valid Redirect URIs`.
     * - La sessione Express deve essere attiva (es: `express-session` correttamente inizializzato).
     */

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
     * *************************** - ITALIANO - *****************************
     * Funzione `login`
     *
     * Questa non è un middleware, ma una **funzione sincrona classica** che forza l'autenticazione dell'utente
     * tramite Keycloak e, se non autenticato, lo redirige alla pagina di login.
     * Dopo il login, l’utente viene reindirizzato all’URL specificato nel parametro `redirectTo`.
     *
     * --- Differenze rispetto a `loginMiddleware` ---
     * - `loginMiddleware` gestisce tutto automaticamente **prima** della funzione handler della rotta.
     * - `login` invece è una funzione **chiamabile manualmente all'interno della funzione di gestione della rotta**,
     *   offrendo **maggiore controllo** su quando e come eseguire il login.
     *
     * --- Parametri ---
     * @param {Object} req - Oggetto `Request` di Express
     * @param {Object} res - Oggetto `Response` di Express
     * @param {string} redirectTo - URL verso cui redirigere l’utente dopo login avvenuto con successo
     *
     * --- Comportamento ---
     * 1. Tenta di proteggere la richiesta tramite `keycloak.protect()`.
     * 2. Se l’utente **è autenticato**, esegue `res.redirect(redirectTo)`.
     * 3. Se **non autenticato**, Keycloak gestisce automaticamente la redirezione alla pagina di login.
     *
     * --- Esempio di utilizzo ---
     * ```js
     * app.get('/login', (req, res) => {
     *     // Logica della tua route
     *     // ...
     *
     *     // Forza l'autenticazione, se necessario
     *     keycloakAdapter.login(req, res, "/home");
     * });
     * ```
     *
     * --- Note ---
     * - La funzione può essere chiamata **dentro una route Express**, quindi permette logiche condizionali personalizzate.
     * - Utile per scenari in cui solo certe condizioni devono forzare il login dell’utente.
     *
     * --- Requisiti ---
     * - Keycloak deve essere correttamente inizializzato e integrato con Express.
     * - I `Valid Redirect URIs` devono includere l’URL passato in `redirectTo`.
     */

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
     * *************************** - ITALIANO - *****************************
     * Funzione `logout`
     *
     * Questa non è un middleware, ma una **funzione sincrona classica** che forza l'utente ad eseguire il logout
     * tramite Keycloak. Oltre a terminare la sessione corrente (se presente), genera l’URL di logout di Keycloak
     * e redirige il browser dell’utente all’indirizzo specificato.
     *
     * --- Differenze rispetto a `logoutMiddleware` ---
     * - `logoutMiddleware` è progettato per essere usato direttamente come middleware nella definizione della rotta.
     * - `logout` invece è una funzione **da richiamare all'interno della route**, utile per gestire il logout **condizionatamente**
     *   o all’interno di una logica più complessa.
     *
     * --- Parametri ---
     * @param {Object} req - Oggetto `Request` di Express
     * @param {Object} res - Oggetto `Response` di Express
     * @param {string} redirectTo - URL verso cui redirigere l’utente dopo il logout
     *
     * --- Comportamento ---
     * 1. Recupera l’`id_token` dal token Keycloak dell’utente corrente (se presente).
     * 2. Costruisce l’URL di logout tramite `keycloak.logoutUrl()`.
     * 3. Distrugge la sessione Express dell’utente.
     * 4. Redirige l’utente al logout URL di Keycloak, che a sua volta reindirizzerà a `redirectTo`.
     *
     * --- Esempio di utilizzo ---
     * ```js
     * app.get('/logout', (req, res) => {
     *     // Eventuale logica personalizzata prima del logout
     *     // ...
     *
     *     keycloakAdapter.logout(req, res, "http://localhost:3001/home");
     * });
     * ```
     *
     * --- Requisiti ---
     * - L’utente deve essere autenticato con Keycloak e avere un token valido in `req.kauth.grant`.
     * - L’URL specificato in `redirectTo` deve essere presente nei `Valid Redirect URIs` nel client di Keycloak.
     */

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
                'login requires middleware to be initialized with valid authServerUrl and realmName'
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
     * @returns {Promise<Object>} Token response from Keycloak (same as login())
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
        let redirectUrL=`${this.authServerUrl}/realms/${this.realmName}/account/`
        res.redirect(redirectUrL);
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


