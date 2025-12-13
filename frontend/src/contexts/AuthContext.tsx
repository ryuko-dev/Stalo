/**
 * Authentication Context
 * 
 * Provides authentication state and methods to the entire app via React Context.
 * Handles login/logout and maintains current user information.
 */

import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { AccountInfo } from '@azure/msal-browser';
import {
  initMsal,
  loginPopup,
  logout as msalLogout,
  getCurrentAccount,
  isAuthenticated as msalIsAuthenticated,
  getUserDisplayName,
  getUserEmail,
} from '../services/authService';

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

  // Initialize MSAL on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        initMsal();
        setIsAuthenticated(msalIsAuthenticated());
        setUser(getCurrentAccount());
      } catch (err: any) {
        console.error('MSAL initialization error:', err);
        // Set error but don't block app - auth is optional
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
      await loginPopup();
      setIsAuthenticated(true);
      setUser(getCurrentAccount());
      console.log('✅ Login successful');
    } catch (err: any) {
      if (err.errorCode === 'user_cancelled_login') {
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
      await msalLogout();
      setIsAuthenticated(false);
      setUser(null);
      console.log('✅ Logout successful');
    } catch (err: any) {
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
    userDisplayName: getUserDisplayName(),
    userEmail: getUserEmail(),
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
