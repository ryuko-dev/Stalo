/**
 * Business Central OData Service
 * 
 * Handles secure API calls to Dynamics 365 Business Central using OAuth2 tokens.
 * Includes automatic token injection, refresh handling, and error management.
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { getAccessToken } from './authService';

interface BCConfig {
  tenantId: string;
  environment: string; // 'Production' or sandbox name
  company: string; // Company name (e.g., 'ARK Group Live')
}

class BusinessCentralService {
  private axiosInstance: AxiosInstance;
  private config: BCConfig;
  private baseUrl: string;

  constructor(config: BCConfig) {
    this.config = config;
    this.baseUrl = `https://api.businesscentral.dynamics.com/v2.0/${config.tenantId}/${config.environment}/ODataV4/Company('${encodeURIComponent(config.company)}')`;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Add request interceptor to inject access token
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        try {
          const token = await getAccessToken();
          config.headers.Authorization = `Bearer ${token}`;
          return config;
        } catch (error) {
          console.error('Failed to get access token:', error);
          throw error;
        }
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle 401 and retry
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            console.warn('⚠️ 401 Unauthorized - attempting silent token refresh...');
            const newToken = await getAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            return Promise.reject(refreshError);
          }
        }

        if (error.response?.status === 403) {
          console.error('❌ 403 Forbidden - User lacks permissions for this resource');
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Fetch data from an OData endpoint
   */
  async fetchEntity(
    entityPath: string,
    filter?: string,
    select?: string,
    top?: number
  ): Promise<any[]> {
    try {
      const params: Record<string, any> = {};

      if (filter) params.$filter = filter;
      if (select) params.$select = select;
      if (top) params.$top = top;

      console.log(`📊 Fetching ${entityPath}...`);
      const response = await this.axiosInstance.get(entityPath, { params });

      return response.data.value || [];
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      console.error(`❌ Error fetching ${entityPath}:`, errorMsg);
      throw new Error(`Failed to fetch ${entityPath}: ${errorMsg}`);
    }
  }

  /**
   * Fetch projects
   */
  async getProjects(select?: string): Promise<any[]> {
    const defaultSelect = 'No,Description';
    return this.fetchEntity('Project_Card_Excel', undefined, select || defaultSelect);
  }

  /**
   * Fetch purchase invoices
   */
  async getPurchaseInvoices(filter?: string): Promise<any[]> {
    const select = 'No,PostingDate,VendorName,Amount,AmountIncludingVAT';
    return this.fetchEntity('Purchase_Invoices', filter, select);
  }

  /**
   * Fetch sales invoices
   */
  async getSalesInvoices(filter?: string): Promise<any[]> {
    const select = 'No,PostingDate,CustomerName,Amount,AmountIncludingVAT';
    return this.fetchEntity('Sales_Invoices', filter, select);
  }

  /**
   * Fetch general ledger entries
   */
  async getGeneralLedgerEntries(filter?: string): Promise<any[]> {
    const select = 'PostingDate,GLAccountNo,Amount,DocumentNo';
    return this.fetchEntity('GL_Entries', filter, select);
  }

  /**
   * Fetch custom entity with flexible parameters
   */
  async fetchCustomEntity(
    entityName: string,
    filter?: string,
    select?: string,
    top?: number
  ): Promise<any[]> {
    return this.fetchEntity(entityName, filter, select, top);
  }

  /**
   * Get configuration
   */
  getConfig(): BCConfig {
    return this.config;
  }
}

let bcService: BusinessCentralService | null = null;

/**
 * Initialize Business Central Service
 */
export function initBusinessCentralService(config: BCConfig): BusinessCentralService {
  if (!config.tenantId || !config.environment || !config.company) {
    throw new Error('Invalid Business Central configuration: tenantId, environment, and company are required');
  }

  bcService = new BusinessCentralService(config);
  console.log(`✅ Business Central Service initialized for company: ${config.company}`);
  return bcService;
}

/**
 * Get Business Central Service instance
 */
export function getBusinessCentralService(): BusinessCentralService {
  if (!bcService) {
    throw new Error('Business Central Service not initialized. Call initBusinessCentralService first.');
  }
  return bcService;
}

export default BusinessCentralService;
