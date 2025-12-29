"use strict";
/**
 * Role-Based Access Control (RBAC) Middleware
 *
 * Checks user roles against required permissions for each route.
 * Must be used AFTER authMiddleware.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAnyRole = exports.requireViewer = exports.requireEditor = exports.requireBudgetManager = exports.requireAdmin = void 0;
exports.clearRoleCache = clearRoleCache;
exports.requireRole = requireRole;
const database_1 = require("../config/database");
// Super admin email - always has full access
const SUPER_ADMIN_EMAIL = 'sinan.mecit@arkgroupdmcc.com';
// Role hierarchy for permission inheritance
const roleHierarchy = {
    'Admin': 4,
    'BudgetManager': 3,
    'Editor': 2,
    'Viewer': 1,
    '': 0,
};
// Cache for user roles to avoid hitting DB on every request
const roleCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
/**
 * Get user role from database
 */
async function getUserRole(email) {
    // Check super admin first
    if (email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return 'Admin';
    }
    // Check cache
    const cached = roleCache.get(email.toLowerCase());
    if (cached && Date.now() < cached.expiry) {
        return cached.role;
    }
    try {
        const pool = await (0, database_1.getConnection)();
        const result = await pool.request()
            .input('email', email)
            .query('SELECT Role FROM dbo.SystemUsers WHERE LOWER(EmailAddress) = LOWER(@email) AND Active = 1');
        const role = (result.recordset[0]?.Role?.trim() || '');
        // Cache the result
        roleCache.set(email.toLowerCase(), {
            role,
            expiry: Date.now() + CACHE_TTL,
        });
        return role;
    }
    catch (error) {
        console.error('Error fetching user role:', error);
        return '';
    }
}
/**
 * Clear role cache for a specific user (call when role is updated)
 */
function clearRoleCache(email) {
    if (email) {
        roleCache.delete(email.toLowerCase());
    }
    else {
        roleCache.clear();
    }
}
/**
 * RBAC middleware factory
 * Creates middleware that requires specific role(s)
 *
 * @param requiredRoles - Minimum role(s) required. Can be single role or array.
 *                        If array, user must have at least one of the roles.
 * @param options - Additional options
 */
function requireRole(requiredRoles, options = {}) {
    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    return async (req, res, next) => {
        try {
            // Must have user from auth middleware
            if (!req.user || !req.user.email) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }
            const userEmail = req.user.email;
            const userRole = await getUserRole(userEmail);
            // Attach role to request for use in route handlers
            req.user.role = userRole;
            // Super admin always has access
            if (userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
                next();
                return;
            }
            // Check self-access if enabled
            if (options.allowSelf && options.selfParam) {
                const resourceOwner = req.params[options.selfParam] || req.body?.[options.selfParam];
                if (resourceOwner && userEmail.toLowerCase() === resourceOwner.toLowerCase()) {
                    next();
                    return;
                }
            }
            // No role assigned
            if (!userRole) {
                res.status(403).json({
                    error: 'No role assigned',
                    message: 'Please contact an administrator to be assigned a role.'
                });
                return;
            }
            // Check if user has required role (using hierarchy)
            const userLevel = roleHierarchy[userRole] || 0;
            const hasRequiredRole = roles.some(role => {
                const requiredLevel = roleHierarchy[role] || 0;
                return userLevel >= requiredLevel;
            });
            if (!hasRequiredRole) {
                res.status(403).json({
                    error: 'Insufficient permissions',
                    required: roles,
                    current: userRole
                });
                return;
            }
            next();
        }
        catch (error) {
            console.error('RBAC middleware error:', error);
            res.status(500).json({ error: 'Authorization error', details: error.message });
        }
    };
}
/**
 * Convenience middleware for common role requirements
 */
exports.requireAdmin = requireRole('Admin');
exports.requireBudgetManager = requireRole('BudgetManager');
exports.requireEditor = requireRole('Editor');
exports.requireViewer = requireRole('Viewer');
/**
 * Middleware for routes that need any authenticated user with a role
 */
exports.requireAnyRole = requireRole(['Admin', 'BudgetManager', 'Editor', 'Viewer']);
exports.default = requireRole;
