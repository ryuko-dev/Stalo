/**
 * Permissions Context
 * 
 * Provides role-based access control (RBAC) throughout the application.
 * Checks user's role from system users database and enforces permissions.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { getSystemUsers } from '../services/staloService';
import type { SystemUser, RoleType } from '../types/systemUsers';

// Super admin email - cannot be changed or revoked
const SUPER_ADMIN_EMAIL = 'sinan.mecit@arkgroupdmcc.com';

export interface PagePermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

interface PermissionsContextType {
  userRole: RoleType | null;
  systemUser: SystemUser | null;
  isLoadingPermissions: boolean;
  hasAccess: boolean; // Has any role assigned
  isAdmin: boolean;
  isBudgetManager: boolean;
  isViewer: boolean;
  isEditor: boolean;
  canAccessSettings: () => boolean;
  getPagePermissions: (page: string) => PagePermissions;
  refreshPermissions: () => Promise<void>;
  viewingAsRole: RoleType | null; // For super admin to view as different roles
  setViewingAsRole: (role: RoleType | null) => void;
  isSuperAdmin: boolean; // True if user is the super admin
  actualRole: RoleType | null; // The user's real role (not the viewing as role)
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, userEmail } = useAuth();
  const [actualUserRole, setActualUserRole] = useState<RoleType | null>(null);
  const [viewingAsRole, setViewingAsRole] = useState<RoleType | null>(null);
  const [systemUser, setSystemUser] = useState<SystemUser | null>(null);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);

  const fetchUserPermissions = async () => {
    if (!isAuthenticated || !userEmail) {
      setActualUserRole(null);
      setSystemUser(null);
      setIsLoadingPermissions(false);
      return;
    }

    // Super admin check - always grant admin access
    if (userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      setActualUserRole('Admin');
      setIsLoadingPermissions(false);
      return;
    }

    try {
      setIsLoadingPermissions(true);
      
      // Wait for database connection with longer timeout
      const maxWaitTime = 30000; // 30 seconds max
      const retryInterval = 2000; // 2 seconds between retries
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          const systemUsers = await getSystemUsers();
          const user = systemUsers.find(u => u.EmailAddress.toLowerCase() === userEmail.toLowerCase());
          
          if (user) {
            setSystemUser(user);
            // Only set role if it's not empty
            const role = user.Role?.trim();
            setActualUserRole(role && role !== '' ? role as RoleType : null);
          } else {
            setSystemUser(null);
            setActualUserRole(null);
          }
          setIsLoadingPermissions(false);
          return; // Success, exit retry loop
        } catch (err: any) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`⏳ Waiting for database connection... (${elapsed}s elapsed)`);
          await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
      }
      
      // If timeout reached
      console.error('⚠️ Database connection timeout. Unable to fetch user permissions');
      setSystemUser(null);
      setActualUserRole(null);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setSystemUser(null);
      setActualUserRole(null);
    } finally {
      setIsLoadingPermissions(false);
    }
  };

  useEffect(() => {
    fetchUserPermissions();
  }, [isAuthenticated, userEmail]);

  // Determine if user is super admin
  const isSuperAdmin = userEmail?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  
  // Use viewingAsRole if super admin is viewing as another role, otherwise use actual role
  const userRole = isSuperAdmin && viewingAsRole ? viewingAsRole : actualUserRole;
  
  const hasAccess = !!userRole;
  const isAdmin = userRole === 'Admin';
  const isBudgetManager = userRole === 'Budget Manager';
  const isViewer = userRole === 'Viewer';
  const isEditor = userRole === 'Editor';

  const canAccessSettings = () => {
    return isAdmin;
  };

  const getPagePermissions = (page: string): PagePermissions => {
    // Default: no permissions
    const noAccess: PagePermissions = {
      canView: false,
      canEdit: false,
      canDelete: false,
      canExport: false,
    };

    if (!hasAccess) return noAccess;

    // Admin has full access to everything
    if (isAdmin) {
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      };
    }

    // Budget Manager permissions
    if (isBudgetManager) {
      switch (page.toLowerCase()) {
        case 'scheduled-records':
        case 'scheduledrecords':
          return {
            canView: true,
            canEdit: true,
            canDelete: true,
            canExport: true,
          };
        case 'glidepath':
          return {
            canView: true,
            canEdit: true,
            canDelete: true,
            canExport: true,
          };
        case 'report':
        case 'reports':
          return {
            canView: true,
            canEdit: false,
            canDelete: false,
            canExport: true,
          };
        case 'home':
        case 'projects':
        case 'resources':
        case 'positions':
        case 'gantt':
        case 'payroll':
          return {
            canView: true,
            canEdit: false,
            canDelete: false,
            canExport: false,
          };
        case 'settings':
          return noAccess;
        default:
          return {
            canView: true,
            canEdit: false,
            canDelete: false,
            canExport: false,
          };
      }
    }

    // Viewer permissions
    if (isViewer) {
      if (page.toLowerCase() === 'home' || page.toLowerCase() === 'gantt') {
        return {
          canView: true,
          canEdit: false,
          canDelete: false,
          canExport: false,
        };
      }
      return noAccess;
    }

    // Editor permissions
    if (isEditor) {
      if (page.toLowerCase() === 'settings') {
        return noAccess;
      }
      return {
        canView: true,
        canEdit: true,
        canDelete: true,
        canExport: true,
      };
    }

    return noAccess;
  };

  const value: PermissionsContextType = {
    userRole,
    systemUser,
    isLoadingPermissions,
    hasAccess,
    isAdmin,
    isBudgetManager,
    isViewer,
    isEditor,
    canAccessSettings,
    getPagePermissions,
    refreshPermissions: fetchUserPermissions,
    viewingAsRole,
    setViewingAsRole,
    isSuperAdmin,
    actualRole: actualUserRole,
  };

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
};

export const usePermissions = (): PermissionsContextType => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within PermissionsProvider');
  }
  return context;
};

export default PermissionsContext;
