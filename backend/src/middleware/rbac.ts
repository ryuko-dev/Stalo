/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Checks user roles against required permissions for each route.
 * Must be used AFTER authMiddleware.
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { getConnection } from '../config/database';

// Role hierarchy - higher roles have all permissions of lower roles
export type RoleType = 'Admin' | 'BudgetManager' | 'Editor' | 'Viewer' | '';

// Super admin email - always has full access
const SUPER_ADMIN_EMAIL = 'sinan.mecit@arkgroupdmcc.com';

// Role hierarchy for permission inheritance
const roleHierarchy: Record<RoleType, number> = {
  'Admin': 4,
  'BudgetManager': 3,
  'Editor': 2,
  'Viewer': 1,
  '': 0,
};

// Cache for user roles to avoid hitting DB on every request
const roleCache: Map<string, { role: RoleType; expiry: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get user role from database
 */
async function getUserRole(email: string): Promise<RoleType> {
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
    const pool = await getConnection();
    const result = await pool.request()
      .input('email', email)
      .query('SELECT Role FROM dbo.SystemUsers WHERE LOWER(EmailAddress) = LOWER(@email) AND Active = 1');
    
    const role = (result.recordset[0]?.Role?.trim() || '') as RoleType;
    
    // Cache the result
    roleCache.set(email.toLowerCase(), {
      role,
      expiry: Date.now() + CACHE_TTL,
    });
    
    return role;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return '';
  }
}

/**
 * Clear role cache for a specific user (call when role is updated)
 */
export function clearRoleCache(email?: string): void {
  if (email) {
    roleCache.delete(email.toLowerCase());
  } else {
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
export function requireRole(
  requiredRoles: RoleType | RoleType[],
  options: { 
    allowSelf?: boolean;  // Allow users to access their own resources
    selfParam?: string;   // Request param containing resource owner email
  } = {}
) {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Must have user from auth middleware
      if (!req.user || !req.user.email) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }
      
      const userEmail = req.user.email;
      const userRole = await getUserRole(userEmail);
      
      // Attach role to request for use in route handlers
      (req.user as any).role = userRole;
      
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
    } catch (error: any) {
      console.error('RBAC middleware error:', error);
      res.status(500).json({ error: 'Authorization error', details: error.message });
    }
  };
}

/**
 * Convenience middleware for common role requirements
 */
export const requireAdmin = requireRole('Admin');
export const requireBudgetManager = requireRole('BudgetManager');
export const requireEditor = requireRole('Editor');
export const requireViewer = requireRole('Viewer');

/**
 * Middleware for routes that need any authenticated user with a role
 */
export const requireAnyRole = requireRole(['Admin', 'BudgetManager', 'Editor', 'Viewer']);

export default requireRole;
