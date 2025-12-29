"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessCentralOdataService = void 0;
exports.initializeBusinessCentralService = initializeBusinessCentralService;
exports.getBusinessCentralService = getBusinessCentralService;
const axios_1 = __importDefault(require("axios"));
/**
 * Business Central OData Service
 * Handles authentication and data retrieval from BC OData v4 API
 */
class BusinessCentralOdataService {
    constructor(config) {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.clientId = config.clientId;
        this.clientSecret = config.clientSecret;
        this.tenantId = config.tenantId;
        this.bcEnvironment = config.bcEnvironment;
        // BC OData URL format: https://api.businesscentral.dynamics.com/v2.0/environments/{environment-id}/api/v2.0
        this.bcUrl = `https://api.businesscentral.dynamics.com/v2.0/environments/${config.bcEnvironment}/api/v2.0`;
        this.axiosInstance = axios_1.default.create({
            baseURL: this.bcUrl,
            timeout: 30000,
        });
        // Add request interceptor to include auth token
        this.axiosInstance.interceptors.request.use(async (config) => {
            const token = await this.getValidToken();
            config.headers.Authorization = `Bearer ${token}`;
            return config;
        }, (error) => Promise.reject(error));
    }
    /**
     * Get a valid access token, refreshing if necessary
     */
    async getValidToken() {
        const now = Date.now();
        // If token exists and is not expired, return it
        if (this.accessToken && this.tokenExpiresAt > now + 60000) { // 60 second buffer
            return this.accessToken;
        }
        // Otherwise, get a new token
        return this.authenticate();
    }
    /**
     * Authenticate with Azure AD and get access token
     */
    async authenticate() {
        try {
            const tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
            const response = await axios_1.default.post(tokenEndpoint, new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: 'https://api.businesscentral.dynamics.com/.default',
                grant_type: 'client_credentials',
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            this.accessToken = response.data.access_token;
            this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
            console.log('✅ Business Central OData authentication successful');
            return this.accessToken;
        }
        catch (error) {
            console.error('❌ Business Central authentication failed:', error.response?.data || error.message);
            throw new Error(`BC Authentication failed: ${error.message}`);
        }
    }
    /**
     * Fetch data from BC OData endpoint
     * @param entityName The OData entity (e.g., 'companies', 'salesOrders', 'items')
     * @param companyId The company ID (UUID) - optional for some endpoints
     * @param filters OData $filter query parameter - optional
     * @param select OData $select query parameter - optional
     */
    async fetchEntity(entityName, companyId, filters, select) {
        try {
            let url = `/companies`;
            // If companyId is provided, include it in the URL
            if (companyId) {
                url += `('${companyId}')/${entityName}`;
            }
            else {
                url += `/${entityName}`;
            }
            const params = {};
            if (filters)
                params.$filter = filters;
            if (select)
                params.$select = select;
            const response = await this.axiosInstance.get(url, { params });
            return response.data.value || [];
        }
        catch (error) {
            console.error(`Error fetching ${entityName}:`, error.response?.data || error.message);
            throw new Error(`Failed to fetch ${entityName}: ${error.message}`);
        }
    }
    /**
     * Fetch companies from BC
     */
    async getCompanies() {
        return this.fetchEntity('companies', undefined, undefined, 'id,displayName');
    }
    /**
     * Fetch sales orders for a company
     */
    async getSalesOrders(companyId, filters) {
        const select = 'id,number,orderDate,customerId,customerName,status,totalAmountIncludingTax';
        return this.fetchEntity('salesOrders', companyId, filters, select);
    }
    /**
     * Fetch sales order lines for a company and order
     */
    async getSalesOrderLines(companyId, orderId) {
        try {
            const url = `/companies('${companyId}')/salesOrders('${orderId}')/salesOrderLines`;
            const response = await this.axiosInstance.get(url);
            return response.data.value || [];
        }
        catch (error) {
            console.error('Error fetching sales order lines:', error.message);
            throw error;
        }
    }
    /**
     * Fetch items (products) from a company
     */
    async getItems(companyId, filters) {
        const select = 'id,number,displayName,unitPrice,blocked';
        return this.fetchEntity('items', companyId, filters, select);
    }
    /**
     * Fetch customers for a company
     */
    async getCustomers(companyId, filters) {
        const select = 'id,number,displayName,email,phone,city,country';
        return this.fetchEntity('customers', companyId, filters, select);
    }
    /**
     * Fetch vendors for a company
     */
    async getVendors(companyId, filters) {
        const select = 'id,number,displayName,email,phone,city,country';
        return this.fetchEntity('vendors', companyId, filters, select);
    }
    /**
     * Fetch purchase orders for a company
     */
    async getPurchaseOrders(companyId, filters) {
        const select = 'id,number,orderDate,vendorId,vendorName,status,totalAmountIncludingTax';
        return this.fetchEntity('purchaseOrders', companyId, filters, select);
    }
    /**
     * Fetch general ledger entries for a company (financial data)
     */
    async getGeneralLedgerEntries(companyId, filters) {
        const select = 'id,postingDate,accountNumber,amount,documentNumber';
        return this.fetchEntity('generalLedgerEntries', companyId, filters, select);
    }
}
exports.BusinessCentralOdataService = BusinessCentralOdataService;
/**
 * Initialize and export singleton BC OData service
 */
let bcService = null;
function initializeBusinessCentralService() {
    if (!bcService) {
        const config = {
            tenantId: process.env.BC_TENANT_ID || '',
            clientId: process.env.BC_CLIENT_ID || '',
            clientSecret: process.env.BC_CLIENT_SECRET || '',
            bcEnvironment: process.env.BC_ENVIRONMENT || 'Production',
        };
        if (!config.tenantId || !config.clientId || !config.clientSecret) {
            console.warn('⚠️ Business Central OData credentials not configured');
        }
        bcService = new BusinessCentralOdataService(config);
    }
    return bcService;
}
function getBusinessCentralService() {
    if (!bcService) {
        return initializeBusinessCentralService();
    }
    return bcService;
}
