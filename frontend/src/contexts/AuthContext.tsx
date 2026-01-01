/**
 * Authentication Context
 * 
 * Provides authentication state and methods to the entire app via React Context.
 * Handles login/logout and maintains current user information with role-based access control.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import {
  initMsal,
  handleRedirectPromise,
  loginPopup,
  loginRedirect,
  logout as msalLogout,
  getCurrentAccount,
  isAuthenticated as msalIsAuthenticated,
  getUserDisplayName,
  getUserEmail,
} from '../services/authService';
import { getSystemUsers, createSystemUser } from '../services/staloService';
import type { SystemUserCreate } from '../types/systemUsers';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: AccountInfo | null;
  userDisplayName: string;
  userEmail: string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AccountInfo | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');

  // Check if user exists in system users table, if not create them
  const ensureUserInDatabase = async (displayName: string, email: string) => {
    try {
      // Wait for database connection with longer timeout
      const maxWaitTime = 30000; // 30 seconds max
      const retryInterval = 2000; // 2 seconds between retries
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        try {
          // Check if user already exists
          const systemUsers = await getSystemUsers();
          const existingUser = systemUsers.find(u => u.EmailAddress.toLowerCase() === email.toLowerCase());
          
          if (!existingUser) {
            // Create new system user with first login date
            const newUser: SystemUserCreate = {
              Name: displayName,
              EmailAddress: email,
              StartDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
              EndDate: null,
              Active: true,
              Role: '', // Empty role to be assigned by admin later
            };
            
            await createSystemUser(newUser);
            console.log(`✅ New user added to system: ${displayName} (${email})`);
          }
          return; // Success, exit retry loop
        } catch (err: any) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          console.log(`⏳ Waiting for database connection... (${elapsed}s elapsed)`);
          await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
      }
      
      // If timeout reached
      console.error('⚠️ Database connection timeout. User can still log in, but role assignment may be delayed');
    } catch (err) {
      console.error('Error ensuring user in database:', err);
      // Don't block login if this fails
    }
  };

  // Initialize MSAL on mount and check for existing session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        await initMsal();
        
        // Handle redirect promise first (if returning from Microsoft login)
        const redirectResponse = await handleRedirectPromise();
        
        if (redirectResponse && redirectResponse.account) {
          // User just completed redirect login
          const displayName = redirectResponse.account.name || '';
          const email = redirectResponse.account.username || '';
          
          setIsAuthenticated(true);
          setUser(redirectResponse.account);
          setUserDisplayName(displayName);
          setUserEmail(email);
          
          // Ensure user is in the system users table
          await ensureUserInDatabase(displayName, email);
          
          console.log(`✅ Redirect login completed: ${displayName} (${email})`);
        } else {
          // Check for existing session (no redirect)
          const authenticated = await msalIsAuthenticated();
          const account = await getCurrentAccount();
          
          setIsAuthenticated(authenticated);
          setUser(account);
          
          if (account) {
            const displayName = await getUserDisplayName();
            const email = await getUserEmail();
            setUserDisplayName(displayName);
            setUserEmail(email);
            
            // Ensure user is in the system users table
            await ensureUserInDatabase(displayName, email);
            
            console.log(`✅ User auto-logged in: ${displayName} (${email})`);
          }
        }
      } catch (err: any) {
        console.error('MSAL initialization error:', err);
        setError(`Auth setup: ${err.message || 'Configuration missing'}`);
      } finally {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const handleLogin = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Use redirect flow in production (more reliable), popup in development
      const isProduction = import.meta.env.PROD;
      
      if (isProduction) {
        // Redirect flow - will navigate away and come back
        console.log('Using redirect login flow for production...');
        await loginRedirect();
        // Note: execution stops here as page redirects
      } else {
        // Popup flow for development
        console.log('Using popup login flow for development...');
        await loginPopup();
        
        const account = await getCurrentAccount();
        const displayName = await getUserDisplayName();
        const email = await getUserEmail();
        
        setIsAuthenticated(true);
        setUser(account);
        setUserDisplayName(displayName);
        setUserEmail(email);
        
        // Ensure user is in the system users table
        await ensureUserInDatabase(displayName, email);
        
        console.log(`✅ Login successful: ${displayName} (${email})`);
        setIsLoading(false);
      }
    } catch (err: any) {
      if (err.errorCode === 'user_cancelled' || err.errorCode === 'user_cancelled_login') {
        console.log('User cancelled login');
        setIsLoading(false);
        return;
      }
      
      // Check if it's a config error
      const errorMsg = err.message || JSON.stringify(err);
      if (errorMsg.includes('Client ID') || errorMsg.includes('not configured') || errorMsg.includes('AADB2C')) {
        setError('❌ OAuth2 Configuration Issue: Please fill in VITE_MSAL_CLIENT_ID and VITE_MSAL_TENANT_ID in frontend/.env.local, then restart the dev server (npm run dev)');
      } else {
        setError(`❌ Login failed: ${err.message || 'Unknown error'}`);
      }
      console.error('Login error details:', err);
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setError(null);
      
      // Clear authentication service cache and logout
      await msalLogout();
      
      // Clear local state
      setIsAuthenticated(false);
      setUser(null);
      setUserDisplayName('');
      setUserEmail('');
      
      console.log('✅ Logout successful - cache cleared, fresh login required');
    } catch (err: any) {
      // Even if logout fails, clear local state
      setIsAuthenticated(false);
      setUser(null);
      setUserDisplayName('');
      setUserEmail('');
      
      setError(err.message || 'Logout failed');
      console.error('Logout error:', err);
    }
  };

  const clearError = () => setError(null);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    error,
    user,
    userDisplayName,
    userEmail,
    login: handleLogin,
    logout: handleLogout,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook to use auth context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export default AuthContext;
