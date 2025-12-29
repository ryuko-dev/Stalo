"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthorizationUrl = getAuthorizationUrl;
exports.getAccessToken = getAccessToken;
exports.validateConfig = validateConfig;
const axios_1 = __importDefault(require("axios"));
// Configuration - should be set from environment variables
const AZURE_TENANT_ID = process.env.AZURE_TENANT_ID || '';
const AZURE_CLIENT_ID = process.env.AZURE_CLIENT_ID || '';
const AZURE_CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback';
const AZURE_AUTH_ENDPOINT = `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0`;
/**
 * Get the authorization URL for Microsoft login
 */
function getAuthorizationUrl() {
    const params = new URLSearchParams({
        client_id: AZURE_CLIENT_ID,
        response_type: 'code',
        scope: 'https://api.businesscentral.dynamics.com/.default',
        redirect_uri: REDIRECT_URI,
        response_mode: 'query',
    });
    return `${AZURE_AUTH_ENDPOINT}/authorize?${params.toString()}`;
}
/**
 * Exchange authorization code for access token
 */
async function getAccessToken(authCode) {
    try {
        const response = await axios_1.default.post(`${AZURE_AUTH_ENDPOINT}/token`, {
            client_id: AZURE_CLIENT_ID,
            client_secret: AZURE_CLIENT_SECRET,
            code: authCode,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
            scope: 'https://api.businesscentral.dynamics.com/.default',
        });
        if (!response.data.access_token) {
            throw new Error('No access token in response');
        }
        return response.data.access_token;
    }
    catch (error) {
        console.error('Token exchange error:', error.response?.data || error.message);
        throw new Error(`Failed to exchange auth code for token: ${error.response?.data?.error_description || error.message}`);
    }
}
/**
 * Validate that Azure AD is properly configured
 */
function validateConfig() {
    if (!AZURE_TENANT_ID || !AZURE_CLIENT_ID || !AZURE_CLIENT_SECRET) {
        return {
            valid: false,
            message: 'Azure AD configuration incomplete. Please set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET in .env',
        };
    }
    return { valid: true, message: 'Azure AD configuration valid' };
}
