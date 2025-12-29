/**
 * Microsoft Authentication Library (MSAL) - Business Central OAuth2 Setup
 * 
 * This module handles OAuth2 authentication with Azure AD for Business Central access.
 * Uses Authorization Code Flow with PKCE for maximum security.
 */

import {
  PublicClientApplication,
  type Configuration,
  type AuthenticationResult,
  type AccountInfo,
  type SilentRequest,
  type PopupRequest,
  type RedirectRequest,
} from '@azure/msal-browser';

// MSAL Configuration
// These values must match your Azure App Registration
const clientId = import.meta.env.VITE_MSAL_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID || 'common';

const msalConfig: Configuration = {
  auth: {
    clientId: clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: import.meta.env.VITE_MSAL_REDIRECT_URI || 'http://localhost:3000',
    postLogoutRedirectUri: import.meta.env.VITE_MSAL_LOGOUT_REDIRECT_URI || 'http://localhost:3000',
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation: 'sessionStorage', // Can be 'sessionStorage' or 'localStorage'
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level: any, message: string, _containsPii?: boolean) => {
        if (_containsPii) return;
        if (import.meta.env.DEV) console.log(`[MSAL] ${message}`);
      },
      piiLoggingEnabled: false,
      logLevel: import.meta.env.DEV ? 3 : 2, // 3 = verbose, 2 = info
    },
  },
};

// Microsoft Graph scopes for user identity and SharePoint access
const loginScopes = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Files.ReadWrite.All', // SharePoint folder creation/access
  'Sites.ReadWrite.All', // SharePoint site access
];

let msalInstance: PublicClientApplication | null = null;

/**
 * Initialize MSAL instance (singleton pattern)
 */

/**
 * Initialize MSAL instance (singleton pattern, async)
 */
export async function initMsal(): Promise<PublicClientApplication> {
  if (msalInstance) return msalInstance;

  if (!msalConfig.auth.clientId) {
    console.warn('MSAL Client ID not configured. OAuth2 authentication disabled. Please configure VITE_MSAL_CLIENT_ID in .env.local to enable.');
  }

  msalInstance = new PublicClientApplication(msalConfig);

  // Await the new async initialize() method if available
  if (typeof msalInstance.initialize === 'function') {
    await msalInstance.initialize();
  }

  // Handle the redirect from Azure AD after login
  msalInstance.handleRedirectPromise().catch((error: any) => {
    console.error('MSAL redirect error:', error);
  });

  return msalInstance;
}

/**
 * Get the MSAL instance
 */
export async function getMsalInstance(): Promise<PublicClientApplication> {
  if (!msalInstance) {
    return await initMsal();
  }
  return msalInstance;
}

/**
 * Login with popup
 */
export async function loginPopup(): Promise<AuthenticationResult> {
  const msalClient = await getMsalInstance();

  const loginRequest: PopupRequest = {
    scopes: loginScopes,
    prompt: 'select_account',
  };

  try {
    console.log('Starting popup login...');
    const response = await msalClient.loginPopup(loginRequest);
    console.log('✅ Popup login successful');
    return response;
  } catch (error: any) {
    console.error('❌ Popup login failed:', error);
    throw error;
  }
}

/**
 * Login with redirect (full page redirect to login)
 */
export async function loginRedirect(): Promise<void> {
  const msalClient = await getMsalInstance();

  const loginRequest: RedirectRequest = {
    scopes: loginScopes,
    prompt: 'select_account',
  };

  try {
    console.log('Starting redirect login...');
    await msalClient.loginRedirect(loginRequest);
  } catch (error: any) {
    console.error('❌ Redirect login failed:', error);
    throw error;
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  const msalClient = await getMsalInstance();
  const account = msalClient.getActiveAccount();

  if (account) {
    await msalClient.logoutPopup({
      account: account,
    });
  }
}

/**
 * Get access token silently (with refresh if needed)
 * Returns token from cache if valid, or refreshes silently
 */
export async function getAccessToken(): Promise<string> {
  const msalClient = await getMsalInstance();
  const accounts = msalClient.getAllAccounts();

  if (accounts.length === 0) {
    throw new Error('No user is currently signed in');
  }

  const account = accounts[0];

  const silentRequest: SilentRequest = {
    scopes: loginScopes,
    account: account,
  };

  try {
    // Try to get token from cache first
    const response = await msalClient.acquireTokenSilent(silentRequest);
    console.log('✅ Token acquired (from cache or refreshed)');
    return response.accessToken;
  } catch (error: any) {
    console.warn('⚠️ Silent token acquisition failed, falling back to popup:', error.errorCode);

    // If silent refresh fails, try popup
    try {
      const response = await msalClient.acquireTokenPopup(silentRequest);
      console.log('✅ Token acquired via popup');
      return response.accessToken;
    } catch (popupError: any) {
      console.error('❌ Token acquisition via popup failed:', popupError);
      throw popupError;
    }
  }
}

/**
 * Get current user account
 */
export async function getCurrentAccount(): Promise<AccountInfo | null> {
  const msalClient = await getMsalInstance();
  const accounts = msalClient.getAllAccounts();
  return accounts.length > 0 ? accounts[0] : null;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  return (await getCurrentAccount()) !== null;
}

/**
 * Get user display name
 */
export async function getUserDisplayName(): Promise<string> {
  const account = await getCurrentAccount();
  return account?.name || 'Unknown User';
}

/**
 * Get user email
 */
export async function getUserEmail(): Promise<string> {
  const account = await getCurrentAccount();
  return account?.username || '';
}

export default {
  initMsal,
  getMsalInstance,
  loginPopup,
  loginRedirect,
  logout,
  getAccessToken,
  getCurrentAccount,
  isAuthenticated,
  getUserDisplayName,
  getUserEmail,
};
