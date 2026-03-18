# Recipes and Patterns

This document contains end-to-end integration recipes combining multiple APIs of `keycloak-express-middleware`.
Each recipe is a self-contained example that shows how methods work together in real application scenarios.

## Menu

- [Recipe 1 - Complete PKCE Login Flow (SPA/BFF)](#recipe-1---complete-pkce-login-flow-spabff)
- [Recipe 2 - Multi-Tenant Express Application](#recipe-2---multi-tenant-express-application)
- [Recipe 3 - Layered Authorization (Role + Scope + Permission)](#recipe-3---layered-authorization-role--scope--permission)
- [Recipe 4 - Adaptive API Response Based on Token](#recipe-4---adaptive-api-response-based-on-token)
- [Recipe 5 - Service-to-Service Token Flow with Auto-Refresh](#recipe-5---service-to-service-token-flow-with-auto-refresh)
- [Recipe 6 - Login, Logout, and Account Management Routes](#recipe-6---login-logout-and-account-management-routes)
- [Recipe 7 - Scope-Gated REST API Endpoints](#recipe-7---scope-gated-rest-api-endpoints)
- [Recipe 8 - Custom Access Denied UX with 403 Interception](#recipe-8---custom-access-denied-ux-with-403-interception)

---

## Recipe 1 - Complete PKCE Login Flow (SPA/BFF)

This recipe shows the full Authorization Code + PKCE flow end-to-end across three routes:
`/auth/start` → Keycloak → `/auth/callback` → application.

```js
const express = require('express');
const session = require('express-session');
const keycloakAdapter = require('keycloak-express-middleware');

const app = express();
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));

const keycloakInstance = new keycloakAdapter(app, {
    realm: process.env.KC_REALM,
    resource: process.env.KC_CLIENT_ID,
    'auth-server-url': process.env.KC_SERVER_URL,
    credentials: { secret: process.env.KC_CLIENT_SECRET }
});

// Step 1: Generate authorization URL and redirect to Keycloak
app.get('/auth/start', (req, res) => {
    const pkce = keycloakInstance.generateAuthorizationUrl({
        redirect_uri: `${process.env.APP_URL}/auth/callback`,
        scope: 'openid profile email offline_access'
    });

    // Persist PKCE artifacts in server-side session
    req.session.pkce_state = pkce.state;
    req.session.pkce_verifier = pkce.codeVerifier;

    res.redirect(pkce.authUrl);
});

// Step 2: Handle Keycloak callback, exchange code for tokens
app.get('/auth/callback', async (req, res) => {
    try {
        // CSRF protection: verify state
        if (!req.query.state || req.query.state !== req.session.pkce_state) {
            return res.status(400).json({ error: 'State mismatch - possible CSRF attack' });
        }

        if (!req.query.code) {
            return res.status(400).json({ error: 'Missing authorization code' });
        }

        const tokens = await keycloakInstance.loginPKCE({
            code: req.query.code,
            redirect_uri: `${process.env.APP_URL}/auth/callback`,
            code_verifier: req.session.pkce_verifier
        });

        // Store tokens in session
        req.session.access_token = tokens.access_token;
        req.session.refresh_token = tokens.refresh_token;
        req.session.token_expires_at = Date.now() + (tokens.expires_in * 1000);

        // Cleanup PKCE artifacts
        delete req.session.pkce_state;
        delete req.session.pkce_verifier;

        res.redirect('/dashboard');
    } catch (err) {
        console.error('PKCE callback error:', err.message);
        res.status(401).json({ error: 'Authentication failed' });
    }
});

// Step 3: Protected route that reads token claims
app.get('/dashboard', keycloakInstance.protectMiddleware(), (req, res) => {
    const claims = keycloakInstance.getTokenClaims(req);
    res.render('dashboard', {
        username: claims.preferred_username,
        email: claims.email,
        scopes: keycloakInstance.getScopes(req)
    });
});

// Logout
app.get('/auth/logout', keycloakInstance.logoutMiddleware(`${process.env.APP_URL}/`));
```

---

## Recipe 2 - Multi-Tenant Express Application

Two independent Keycloak clients within one Express app, each with isolated routes and sessions.

```js
const express = require('express');
const keycloakAdapter = require('keycloak-express-middleware');

const app = express();

// Tenant A: points to realm-a
const kcTenantA = new keycloakAdapter(app, {
    realm: 'realm-a',
    resource: 'client-a',
    'auth-server-url': process.env.KC_SERVER_URL,
    credentials: { secret: process.env.TENANT_A_SECRET }
}, { session: { secret: process.env.SESSION_SECRET_A } });

// Tenant B: points to realm-b
const kcTenantB = new keycloakAdapter(app, {
    realm: 'realm-b',
    resource: 'client-b',
    'auth-server-url': process.env.KC_SERVER_URL,
    credentials: { secret: process.env.TENANT_B_SECRET }
}, { session: { secret: process.env.SESSION_SECRET_B } });

// Tenant A routes — only Client A token accepted
app.get('/a/login', kcTenantA.loginMiddleware('/a/dashboard'));
app.get('/a/dashboard', kcTenantA.protectMiddleware(), (req, res) => {
    const claims = kcTenantA.getTokenClaims(req);
    res.json({ tenant: 'A', user: claims.preferred_username });
});
app.get('/a/admin', kcTenantA.protectMiddleware('admin'), (req, res) => {
    res.json({ tenant: 'A', access: 'admin' });
});

// Tenant B routes — only Client B token accepted
app.get('/b/login', kcTenantB.loginMiddleware('/b/dashboard'));
app.get('/b/dashboard', kcTenantB.protectMiddleware(), (req, res) => {
    const claims = kcTenantB.getTokenClaims(req);
    res.json({ tenant: 'B', user: claims.preferred_username });
});

// Dynamic tenant routing from URL prefix
app.get('/tenant/:tenantId/resource', (req, res, next) => {
    const kc = req.params.tenantId === 'a' ? kcTenantA : kcTenantB;
    kc.protectMiddleware()(req, res, next);
}, (req, res) => {
    res.json({ resource: `Data for tenant ${req.params.tenantId}` });
});
```

---

## Recipe 3 - Layered Authorization (Role + Scope + Permission)

Combine `protectMiddleware`, `requireScopes`, and `enforcerMiddleware` in a chain for maximum control.

```js
// Route requires:
//   1. A valid authenticated user (protectMiddleware)
//   2. The 'reports' and 'email' scopes present in the token (requireScopes)
//   3. A 'report-resource:view' permission authorized in Keycloak Authorization Services (enforcerMiddleware)
app.get(
    '/api/reports',
    keycloakInstance.protectMiddleware('analyst'),       // Must have 'analyst' role
    keycloakInstance.requireScopes(['reports', 'email'], 'all'), // Must have both scopes
    keycloakInstance.enforcerMiddleware('report-resource:view'), // Must have UMA permission
    (req, res) => {
        const claims = keycloakInstance.getTokenClaims(req);
        res.json({
            reports: getReports(),
            requestedBy: claims.preferred_username
        });
    }
);

// Another example: admin bypass + scope check
app.get(
    '/api/sensitive',
    keycloakInstance.protectMiddleware((token, req) => {
        // Admins always get through; others need the 'sensitive-data' scope
        if (token.hasRealmRole('admin')) return true;
        return keycloakInstance.hasScopeFromRequest(req, 'sensitive-data');
    }),
    (req, res) => {
        res.json({ data: getSensitiveData() });
    }
);
```

---

## Recipe 4 - Adaptive API Response Based on Token

A single endpoint that returns different payloads depending on roles and scopes, without blocking.

```js
app.get('/api/user/profile',
    keycloakInstance.protectMiddleware(), // Must be authenticated
    keycloakInstance.encodeTokenRole(),   // Attach role helpers
    (req, res) => {
        const claims = keycloakInstance.getTokenClaims(req);
        const scopes = keycloakInstance.getScopes(req);

        // Base response: always included
        const profile = {
            id: claims.sub,
            username: claims.preferred_username,
            givenName: claims.given_name,
            familyName: claims.family_name
        };

        // Include email only if email scope granted
        if (scopes.includes('email')) {
            profile.email = claims.email;
        }

        // Include phone only if phone scope granted
        if (scopes.includes('phone')) {
            profile.phone = claims.phone_number;
        }

        // Include admin metadata for admin role only
        if (req.encodedTokenRole.hasRole('admin') || req.encodedTokenRole.hasRole('realm:admin')) {
            profile.adminMetadata = {
                createdAt: claims.iat,
                tokenExpiry: new Date(claims.exp * 1000).toISOString(),
                issuer: claims.iss,
                allScopes: scopes
            };
        }

        // Mark premium features
        profile.features = {
            basicAccess: true,
            advancedExport: scopes.includes('export') || req.encodedTokenRole.hasRole('premium'),
            adminPanel: req.encodedTokenRole.hasRole('realm:admin')
        };

        res.json(profile);
    }
);
```

---

## Recipe 5 - Service-to-Service Token Flow with Auto-Refresh

Backend service that calls protected APIs using official helpers `getServiceToken()` and `callProtectedApi()`.

The helpers already provide:

- Technical token retrieval (`client_credentials`)
- In-memory token cache
- Automatic forced refresh + retry once on 401 (service mode)
- Optional per-tenant cache partitioning (`cacheKey`)

```js
const keycloakAdapter = require('keycloak-express-middleware');
const express = require('express');
const app = express();

const keycloakInstance = new keycloakAdapter(app, {
    realm: process.env.KC_REALM,
    resource: process.env.KC_CLIENT_ID,
    'auth-server-url': process.env.KC_SERVER_URL,
    credentials: { secret: process.env.KC_CLIENT_SECRET }
});

// Optional: inspect token source (fresh/cache)
app.get('/internal/token-metadata', async (req, res) => {
    const tokenInfo = await keycloakInstance.getServiceToken({
        scope: 'internal.read',
        minValiditySeconds: 30,
        cacheKey: 'internal-api/default'
    });

    res.json({
        source: tokenInfo.source,
        expiresAt: tokenInfo.expiresAt,
        scope: tokenInfo.scope
    });
});

// Route that calls another protected service in service mode
app.get('/internal/data', async (req, res) => {
    try {
        const upstream = await keycloakInstance.callProtectedApi({
            url: 'https://internal-api.example.com/data',
            method: 'GET',
            authMode: 'service',
            serviceTokenOptions: {
                scope: 'internal.read'
            },
            timeoutMs: 8000
        });

        if (!upstream.ok) {
            return res.status(upstream.status).json({
                error: 'Upstream call failed',
                details: upstream.data,
                auth: upstream.auth
            });
        }

        res.json({
            data: upstream.data,
            auth: upstream.auth
        });
    } catch (err) {
        console.error('Service call failed:', err.message);
        res.status(503).json({ error: 'Service unavailable' });
    }
});

// Route that forwards user identity instead of service identity
app.get('/internal/me', async (req, res) => {
    const userToken = req?.kauth?.grant?.access_token?.token;

    if (!userToken) {
        return res.status(401).json({ error: 'Missing user token in request context' });
    }

    const upstream = await keycloakInstance.callProtectedApi({
        url: 'https://profile-api.example.com/me',
        authMode: 'user',
        userToken
    });

    res.status(upstream.status).json(upstream.data);
});
```

---

## Recipe 6 - Login, Logout, and Account Management Routes

Complete authentication lifecycle routes using both middleware and imperative styles.

```js
const keycloakAdapter = require('keycloak-express-middleware');
const express = require('express');
const app = express();

const keycloakInstance = new keycloakAdapter(app, keycloakConfig, {
    session: { secret: process.env.SESSION_SECRET }
});

// --- Login ---

// Middleware style (simplest)
app.get('/login', keycloakInstance.loginMiddleware('/dashboard'));

// Imperative style (with pre-login logic)
app.get('/login-with-audit', (req, res) => {
    console.log(`[AUTH] Login attempt from ${req.ip} at ${new Date().toISOString()}`);
    keycloakInstance.login(req, res, '/dashboard');
});

// --- Logout ---

// Middleware style
app.get('/logout', keycloakInstance.logoutMiddleware('/'));

// Imperative style (with cleanup)
app.get('/logout-and-cleanup', async (req, res) => {
    const username = keycloakInstance.getTokenClaims(req).preferred_username;
    console.log(`[AUTH] ${username} logging out`);
    await clearUserCache(username); // Custom cleanup
    keycloakInstance.logout(req, res, '/goodbye');
});

// --- Account management ---
app.get('/my-account', keycloakInstance.protectMiddleware(), (req, res) => {
    keycloakInstance.redirectToUserAccountConsole(res);
});

// --- User info route ---
app.get('/me', keycloakInstance.protectMiddleware(), (req, res) => {
    const claims = keycloakInstance.getTokenClaims(req);
    const scopes = keycloakInstance.getScopes(req);
    res.json({
        id: claims.sub,
        username: claims.preferred_username,
        email: keycloakInstance.hasScopeFromRequest(req, 'email') ? claims.email : undefined,
        authenticated: true,
        scopes
    });
});

// --- Public route: show login button if not authenticated ---
app.get('/', (req, res) => {
    const isLoggedIn = keycloakInstance.isAuthenticated(req);
    res.render('home', { isLoggedIn });
});
```

---

## Recipe 7 - Scope-Gated REST API Endpoints

A REST API where different endpoints require different scope combinations.

```js
const keycloakAdapter = require('keycloak-express-middleware');
const express = require('express');
const app = express();

const kc = new keycloakAdapter(app, keycloakConfig);

// GET /api/users — requires profile scope
app.get('/api/users',
    kc.protectMiddleware(),
    kc.requireScopes(['profile'], 'all'),
    (req, res) => res.json({ users: getUsers() })
);

// GET /api/users/:id/email — requires profile + email scope
app.get('/api/users/:id/email',
    kc.protectMiddleware(),
    kc.requireScopes(['profile', 'email'], 'all'),
    (req, res) => res.json({ email: getUserEmail(req.params.id) })
);

// POST /api/users — requires admin role AND write scope
app.post('/api/users',
    kc.protectMiddleware('admin'),
    kc.requireScopes(['write'], 'all'),
    (req, res) => {
        const created = createUser(req.body);
        res.status(201).json(created);
    }
);

// DELETE /api/users/:id — requires admin role AND at least one of: delete, admin-full scopes
app.delete('/api/users/:id',
    kc.protectMiddleware('admin'),
    kc.requireScopes(['delete', 'admin-full'], 'any'),
    (req, res) => {
        deleteUser(req.params.id);
        res.status(204).send();
    }
);

// GET /api/export — flexible: CSV, Excel, or PDF scope grants access
app.get('/api/export',
    kc.protectMiddleware(),
    kc.requireScopes(['export-csv', 'export-excel', 'export-pdf'], 'any'),
    (req, res) => {
        const format = req.query.format || 'csv';
        const data = exportData(format);
        res.attachment(`export.${format}`).send(data);
    }
);
```

---

## Recipe 8 - Custom Access Denied UX with 403 Interception

Combine `keycloak-express-middleware` with `responseinterceptor` to show friendly error pages.

```js
const responseinterceptor = require('responseinterceptor');
const keycloakAdapter = require('keycloak-express-middleware');
const express = require('express');
const app = express();

app.set('view engine', 'ejs');

const kc = new keycloakAdapter(app, keycloakConfig, {
    session: { secret: process.env.SESSION_SECRET }
});

// Helper interceptor: render custom 403 page
function renderAccessDenied(req, respond) {
    req.app.render('access-denied', { path: req.path }, (err, html) => {
        respond(200, err ? '<h1>Access Denied</h1>' : html);
    });
}

// Helper interceptor: redirect dynamically based on path
function redirectByPath(req, respond) {
    const routes = {
        '/admin': '/access-denied-admin',
        '/reports': '/access-denied-reports'
    };
    respond(routes[req.path] || '/access-denied');
}

// Route 1: render custom page on 403
app.get('/admin/panel',
    responseinterceptor.interceptByStatusCode(403, renderAccessDenied),
    kc.protectMiddleware('admin'),
    (req, res) => res.render('admin-panel')
);

// Route 2: dynamic redirect on 403
app.get('/reports',
    responseinterceptor.interceptByStatusCodeRedirectTo(403, redirectByPath),
    kc.protectMiddleware('analyst'),
    (req, res) => res.render('reports')
);

// Route 3: static redirect on 403
app.get('/settings',
    responseinterceptor.interceptByStatusCodeRedirectTo(403, '/access-denied'),
    kc.protectMiddleware('manager'),
    (req, res) => res.render('settings')
);

// Dedicated access-denied pages
app.get('/access-denied', (req, res) => res.render('access-denied'));
app.get('/access-denied-admin', (req, res) => res.render('access-denied-admin'));
app.get('/access-denied-reports', (req, res) => res.render('access-denied-reports'));
```

---

## See also

- [API Reference - README.md](../README.md#api-documentation)
- [OIDC Integration Guide](./OIDC_INTEGRATION_GUIDE.md)
- [Architecture](./architecture.md)
- [Testing Guide](./testing.md)
