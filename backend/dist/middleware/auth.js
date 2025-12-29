"use strict";
/**
 * Authentication Middleware
 *
 * Validates Azure AD JWT tokens on incoming requests.
 * Uses JWKS (JSON Web Key Set) for token verification.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuthMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const jwks_rsa_1 = __importDefault(require("jwks-rsa"));
// Azure AD configuration
const TENANT_ID = process.env.MSAL_TENANT_ID || process.env.BC_TENANT_ID || '';
const CLIENT_ID = process.env.MSAL_CLIENT_ID || '';
// JWKS client - lazy initialization to avoid issues with empty tenant
let jwksClient = null;
function getJwksClient() {
    if (!TENANT_ID)
        return null;
    if (!jwksClient) {
        jwksClient = (0, jwks_rsa_1.default)({
            jwksUri: `https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 600000, // 10 minutes
        });
    }
    return jwksClient;
}
/**
 * Get signing key from JWKS
 */
function getKey(header, callback) {
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
const verifyOptions = {
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
const authMiddleware = async (req, res, next) => {
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
            const decoded = jsonwebtoken_1.default.decode(token);
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
        jsonwebtoken_1.default.verify(token, getKey, verifyOptions, (err, decoded) => {
            if (err) {
                console.error('Token verification failed:', err.message);
                if (err.name === 'TokenExpiredError') {
                    res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
                    return;
                }
                res.status(401).json({ error: 'Invalid token', details: err.message });
                return;
            }
            const payload = decoded;
            // Attach user info to request
            req.user = {
                email: payload.preferred_username || payload.email || payload.upn || '',
                name: payload.name || '',
                oid: payload.oid || '',
                tid: payload.tid || '',
                roles: payload.roles || [],
            };
            next();
        });
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error', details: error.message });
    }
};
exports.authMiddleware = authMiddleware;
/**
 * Optional authentication middleware
 * Tries to authenticate but allows request to proceed even without token
 * Useful for endpoints that behave differently for authenticated users
 */
const optionalAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token, continue without user
        next();
        return;
    }
    // If token provided, validate it
    await (0, exports.authMiddleware)(req, res, next);
};
exports.optionalAuthMiddleware = optionalAuthMiddleware;
exports.default = exports.authMiddleware;
