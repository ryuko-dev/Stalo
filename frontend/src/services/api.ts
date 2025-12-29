import axios from 'axios';
import { getMsalInstance, loginScopes } from './authService';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor to add authentication token
 */
api.interceptors.request.use(
  async (config) => {
    try {
      const msalInstance = await getMsalInstance();
      const accounts = msalInstance.getAllAccounts();
      
      if (accounts.length > 0) {
        // Try to get token silently
        const silentRequest = {
          account: accounts[0],
          scopes: loginScopes,
        };
        
        try {
          const response = await msalInstance.acquireTokenSilent(silentRequest);
          // Use ID Token for backend authentication since we don't have a custom API scope
          // The Access Token is for Microsoft Graph and will be rejected by our backend
          config.headers.Authorization = `Bearer ${response.idToken}`;
        } catch (silentError) {
          // If silent token acquisition fails, the user might need to re-login
          // Don't block the request - let the backend return 401
          console.warn('Silent token acquisition failed, request will proceed without token');
        }
      }
    } catch (error) {
      // MSAL not initialized or other error - proceed without token
      console.warn('Could not acquire token for API request');
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle authentication errors
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const msalInstance = await getMsalInstance();
        const accounts = msalInstance.getAllAccounts();
        
        if (accounts.length > 0) {
          // Try to refresh the token
          const silentRequest = {
            account: accounts[0],
            scopes: loginScopes,
            forceRefresh: true,
          };
          
          try {
            const response = await msalInstance.acquireTokenSilent(silentRequest);
            originalRequest.headers.Authorization = `Bearer ${response.accessToken}`;
            return api(originalRequest);
          } catch (refreshError) {
            // Token refresh failed - user needs to re-login
            console.error('Token refresh failed, user needs to re-login');
            // Dispatch custom event for app to handle re-login
            window.dispatchEvent(new CustomEvent('auth:token-expired'));
          }
        }
      } catch (error) {
        console.error('Error handling 401 response');
      }
    }
    
    // Handle 403 Forbidden - insufficient permissions
    if (error.response?.status === 403) {
      console.error('Access denied - insufficient permissions');
      // Dispatch custom event for app to handle permission denied
      window.dispatchEvent(new CustomEvent('auth:permission-denied', {
        detail: error.response?.data
      }));
    }
    
    return Promise.reject(error);
  }
);

export default api;
