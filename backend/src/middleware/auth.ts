/**
 * Authentication Middleware
 * 
 * Validates Azure AD JWT tokens on incoming requests.
 * Uses JWKS (JSON Web Key Set) for token verification.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

// Azure AD configuration
const TENANT_ID = process.env.MSAL_TENANT_ID || process.env.BC_TENANT_ID || '';
const CLIENT_ID = process.env.MSAL_CLIENT_ID || '';

// Allowed email domains (comma-separated in env var)
// Example: "arkgroupdmcc.com,example.com"
const ALLOWED_DOMAINS = process.env.ALLOWED_EMAIL_DOMAINS 
  ? process.env.ALLOWED_EMAIL_DOMAINS.split(',').map(d => d.trim().toLowerCase())
  : [];

// JWKS client - lazy initialization to avoid issues with empty tenant
let jwksClient: jwksRsa.JwksClient | null = null;

function getJwksClient(): jwksRsa.JwksClient | null {
  if (!TENANT_ID) return null;
  if (!jwksClient) {
    jwksClient = jwksRsa({
      jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600000, // 10 minutes
    });
  }
  return jwksClient;
}

// Extended request type with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    name: string;
    oid: string; // Object ID from Azure AD
    tid: string; // Tenant ID
    roles?: string[];
  };
}

/**
 * Get signing key from JWKS
 */
function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error('No kid in token header'));
    return;
  }
  
  const client = getJwksClient();
  if (!client) {
    callback(new Error('JWKS client not initialized - TENANT_ID not set'));
    return;
  }
  
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      callback(err);
      return;
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Verify JWT token options
 */
const verifyOptions: jwt.VerifyOptions = {
  algorithms: ['RS256'],
  issuer: [
    `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
    `https://sts.windows.net/${TENANT_ID}/`,
  ],
  // Don't validate audience if CLIENT_ID not set (for flexibility)
  ...(CLIENT_ID && { audience: CLIENT_ID }),
};

/**
 * Authentication middleware
 * Validates the Bearer token and attaches user info to request
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      res.status(401).json({ error: 'No authorization header provided' });
      return;
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Invalid authorization header format' });
      return;
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    // Skip validation if tenant ID not configured (development mode)
    if (!TENANT_ID) {
      console.warn('⚠️ Auth middleware: TENANT_ID not configured, skipping token validation');
      // Try to decode token without verification for dev
      const decoded = jwt.decode(token) as any;
      if (decoded) {
        req.user = {
          email: decoded.preferred_username || decoded.email || decoded.upn || 'unknown',
          name: decoded.name || 'Unknown User',
          oid: decoded.oid || '',
          tid: decoded.tid || '',
          roles: decoded.roles || [],
        };
      }
      next();
      return;
    }

    // Verify token with Azure AD public keys
    jwt.verify(token, getKey, verifyOptions, (err, decoded) => {
      if (err) {
        console.error('Token verification failed:', err.message);
        if (err.name === 'TokenExpiredError') {
          res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
          return;
        }
        res.status(401).json({ error: 'Invalid token', details: err.message });
        return;
      }
      
      const payload = decoded as any;
      
      // Attach user info to request
      req.user = {
        email: payload.preferred_username || payload.email || payload.upn || '',
        name: payload.name || '',
        oid: payload.oid || '',
        tid: payload.tid || '',
        roles: payload.roles || [],
      };
      
      // Check if user's email domain is allowed
      if (ALLOWED_DOMAINS.length > 0 && req.user.email) {
        const emailDomain = req.user.email.split('@')[1]?.toLowerCase();
        if (!emailDomain || !ALLOWED_DOMAINS.includes(emailDomain)) {
          console.warn(`🚫 Access denied for domain: ${emailDomain} (user: ${req.user.email})`);
          res.status(403).json({ 
            error: 'Access denied', 
            message: 'Your email domain is not authorized to access this application'
          });
          return;
        }
      }
      
      next();
    });
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error', details: error.message });
  }
};

/**
 * Optional authentication middleware
 * Tries to authenticate but allows request to proceed even without token
 * Useful for endpoints that behave differently for authenticated users
 */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token, continue without user
    next();
    return;
  }
  
  // If token provided, validate it
  await authMiddleware(req, res, next);
};

export default authMiddleware;
