import { Request, Response, NextFunction } from 'express';

/**
 * Main Keycloak middleware adapter for Express applications
 */
declare module 'keycloak-express-middleware' {
  
  /**
   * Token claims structure (decoded JWT)
   */
  interface TokenClaims {
    sub?: string;
    aud?: string[];
    iss?: string;
    exp?: number;
    iat?: number;
    scope?: string;
    [key: string]: any;
  }

  /**
   * Keycloak adapter instance
   */
  interface KeycloakAdapter {
    config?: any;
    grant?: any;
  }

  /**
   * Scope validation modes
   */
  type ScopeMode = 'all' | 'any';

  type OutboundAuthMode = 'service' | 'user' | 'passthrough' | 'none';

  interface ServiceTokenOptions {
    scope?: string | string[];
    client_id?: string;
    clientId?: string;
    client_secret?: string;
    clientSecret?: string;
    forceRefresh?: boolean;
    minValiditySeconds?: number;
    cacheKey?: string;
    [key: string]: any;
  }

  interface ServiceTokenResult {
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    expiresAt: number;
    scope?: string;
    source: 'cache' | 'fresh';
    tokenResponse: any;
  }

  interface CallProtectedApiOptions {
    url: string;
    method?: string;
    headers?: Record<string, string>;
    body?: any;
    json?: any;
    authMode?: OutboundAuthMode;
    userToken?: string;
    serviceTokenOptions?: ServiceTokenOptions;
    retryOnAuthError?: boolean;
    timeoutMs?: number;
    [key: string]: any;
  }

  interface CallProtectedApiResult {
    ok: boolean;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
    auth: {
      mode: OutboundAuthMode;
      tokenSource?: 'cache' | 'fresh';
      retriedWithFreshToken: boolean;
    };
  }

  /**
   * Main Keycloak class constructor options
   */
  interface KeycloakOptions {
    realm?: string;
    bearer_only?: boolean;
    ssl_required?: string;
    resource?: string;
    credentials?: {
      secret?: string;
    };
    [key: string]: any;
  }

  /**
   * Main Keycloak middleware class
   */
  class Keycloak {
    constructor(options?: KeycloakOptions);
    
    // Middleware factory methods
    middleware(): (req: Request, res: Response, next: NextFunction) => void;
    protect(spec?: string | boolean | ((req: Request, res: Response) => boolean | string)): (req: Request, res: Response, next: NextFunction) => void;
    enforcer(spec?: string | ((req: Request, res: Response) => boolean)): (req: Request, res: Response, next: NextFunction) => void;
    
    // Login/Logout methods
    login(): (req: Request, res: Response, next: NextFunction) => void;
    loginMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    logout(): (req: Request, res: Response, next: NextFunction) => void;
    logoutMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    redirectToUserAccountConsole(): (req: Request, res: Response, next: NextFunction) => void;
    
    // OIDC methods
    generateAuthorizationUrl(options: {
      redirect_uri: string;
      redirectUri?: string;
      scope?: string;
      state?: string;
    }): { authorization_url: string; code_verifier: string; code_challenge: string };
    
    loginWithCredentials(credentials: {
      username?: string;
      password?: string;
      clientId?: string;
      client_id?: string;
      clientSecret?: string;
      client_secret?: string;
    }): Promise<any>;
    
    loginPKCE(options: {
      code: string;
      redirect_uri: string;
      redirectUri?: string;
      code_verifier: string;
      codeVerifier?: string;
    }): Promise<any>;
    
    // Scope helpers
    hasScope(scopeInput: string | string[], requiredScope: string): boolean;
    hasScopes(scopeInput: string | string[], requiredScopes: string[], mode?: ScopeMode): boolean;
    getTokenClaims(req: Request): TokenClaims;
    isAuthenticated(req: Request): boolean;
    getScopes(scopeInputOrReq: string | string[] | Request): string[];
    hasScopeFromRequest(req: Request, requiredScope: string): boolean;
    hasScopesFromRequest(req: Request, requiredScopes: string[], mode?: ScopeMode): boolean;
    requireScopes(requiredScopes: string[], mode?: ScopeMode): (req: Request, res: Response, next: NextFunction) => void;

    // Service-to-service helpers
    getServiceToken(options?: ServiceTokenOptions): Promise<ServiceTokenResult>;
    callProtectedApi(options: CallProtectedApiOptions): Promise<CallProtectedApiResult>;
  }

  export default Keycloak;
  
  /**
   * Factory function to create Keycloak instance
   */
  function keycloakExpress(options?: KeycloakOptions): Keycloak;
  
  export { keycloakExpress };
}

/**
 * Express Request extension for Keycloak properties
 */
declare global {
  namespace Express {
    interface Request {
      kauth?: {
        grant?: any;
      };
      encodedTokenRole?: string;
      hasPermission?: (permission: string) => boolean;
    }
  }
}
