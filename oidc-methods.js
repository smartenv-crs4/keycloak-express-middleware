/**
 * OIDC Authentication Methods for keycloak-express-middleware
 * 
 * These methods provide OAuth2 OIDC token endpoint helpers:
 * - generateAuthorizationUrl(): Generate PKCE authorization URL
 * - login(): Exchange credentials for tokens (generic OIDC grant)
 * - loginPKCE(): Exchange authorization code for tokens (PKCE flow)
 * 
 * Integration Instructions:
 * 1. Copy these methods into the keycloakExpressMiddleware class in index.js
 * 2. In the constructor, save the keyCloakConfig:
 *    this.keyCloakConfig = keyCloackConfig;
 *    this.clientId = keyCloackConfig.resource || keyCloackOptions.clientId;
 *    this.clientSecret = keyCloackConfig.credentials?.secret || keyCloackOptions.clientSecret;
 * 3. Run tests to verify: npm test
 * 4. No external dependencies needed (crypto is built-in, fetch is global in Node 18+)
 */

const crypto = require('crypto');

/**
 * Helper: Base64url encode for PKCE
 * @private
 */
function base64url(buffer) {
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
 * 
 * // Output:
 * // {
 * //   authUrl: 'https://keycloak.../auth?client_id=...&code_challenge=...',
 * //   state: 'random_state_value',
 * //   codeVerifier: 'random_verifier_value'
 * // }
 * 
 * // Store in session
 * req.session.pkce_state = pkceFlow.state;
 * req.session.pkce_verifier = pkceFlow.codeVerifier;
 * 
 * // Redirect user to Keycloak
 * res.redirect(pkceFlow.authUrl);
 */
function generateAuthorizationUrl(options = {}) {
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
  const codeVerifier = base64url(crypto.randomBytes(96));
  const codeChallenge = base64url(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );

  // Generate or use provided state
  const state = customState || base64url(crypto.randomBytes(32));

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
 * @returns {Promise<Object>} Token response from Keycloak:
 *   - access_token: JWT access token
 *   - refresh_token: Refresh token (if configured)
 *   - id_token: ID token (if openid scope requested)
 *   - expires_in: Token expiration in seconds
 *   - token_type: Always "Bearer"
 * 
 * @throws {Error} If token request fails
 * 
 * @example
 * // Resource Owner Password Grant
 * const tokens = await keycloakAdapter.login({
 *   grant_type: 'password',
 *   username: 'user@example.com',
 *   password: 'password123',
 *   scope: 'openid profile email'
 * });
 * 
 * @example
 * // Client Credentials Grant
 * const tokens = await keycloakAdapter.login({
 *   grant_type: 'client_credentials',
 *   scope: 'openid profile'
 * });
 * 
 * @example
 * // Refresh Token Grant
 * const tokens = await keycloakAdapter.login({
 *   grant_type: 'refresh_token',
 *   refresh_token: oldRefreshToken
 * });
 */
async function login(credentials = {}) {
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
 * 
 * @throws {Error} If any required parameter is missing or token exchange fails
 * 
 * @example
 * app.get('/auth/callback', async (req, res) => {
 *   const { code, state } = req.query;
 *   
 *   // Validate state (CSRF protection)
 *   if (state !== req.session.pkce_state) {
 *     return res.status(400).send('CSRF attack detected');
 *   }
 *   
 *   try {
 *     // Exchange code for tokens
 *     const tokens = await keycloakAdapter.loginPKCE({
 *       code,
 *       redirect_uri: 'https://app.example.com/auth/callback',
 *       code_verifier: req.session.pkce_verifier
 *     });
 *     
 *     // Set secure cookies
 *     res.cookie('access_token', tokens.access_token, {
 *       httpOnly: true,
 *       secure: true,
 *       sameSite: 'strict'
 *     });
 *     
 *     res.redirect('/dashboard');
 *   } catch (error) {
 *     res.status(401).send('Authentication failed');
 *   }
 * });
 */
async function loginPKCE(credentials = {}) {
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

  return this.login({
    grant_type: 'authorization_code',
    code: resolvedCode,
    redirect_uri: resolvedRedirectUri,
    code_verifier: resolvedCodeVerifier,
    ...(resolvedClientId ? { client_id: resolvedClientId } : {}),
    ...(resolvedClientSecret ? { client_secret: resolvedClientSecret } : {}),
    ...rest
  });
}

module.exports = {
  generateAuthorizationUrl,
  login,
  loginPKCE
};
