"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const businessCentralService_1 = require("../services/businessCentralService");
const azureAuthService_1 = require("../services/azureAuthService");
const router = (0, express_1.Router)();
// Store access tokens in memory (per session - use session store in production)
const tokenStore = new Map();
/**
 * POST /api/project-report/auth/url
 * Get the Microsoft login URL
 */
router.post('/auth/url', (req, res) => {
    try {
        const config = (0, azureAuthService_1.validateConfig)();
        if (!config.valid) {
            return res.status(400).json({ error: config.message });
        }
        const authUrl = (0, azureAuthService_1.getAuthorizationUrl)();
        res.json({ authUrl });
    }
    catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: error.message || 'Failed to generate auth URL' });
    }
});
/**
 * POST /api/project-report/auth/callback
 * Handle OAuth callback and exchange code for token
 */
router.post('/auth/callback', async (req, res) => {
    try {
        const { code, sessionId } = req.body;
        if (!code || !sessionId) {
            return res.status(400).json({ error: 'code and sessionId are required' });
        }
        const config = (0, azureAuthService_1.validateConfig)();
        if (!config.valid) {
            return res.status(400).json({ error: config.message });
        }
        // Exchange auth code for access token
        const accessToken = await (0, azureAuthService_1.getAccessToken)(code);
        // Store token in memory (in production, use a session store like Redis)
        tokenStore.set(sessionId, accessToken);
        res.json({ success: true, message: 'Authenticated successfully' });
    }
    catch (error) {
        console.error('Auth callback error:', error);
        res.status(401).json({ error: error.message || 'Authentication failed' });
    }
});
/**
 * GET /api/project-report/projects
 * Get list of projects for the filter dropdown
 */
router.get('/projects', async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId || !tokenStore.has(sessionId)) {
            return res.status(401).json({ error: 'Not authenticated. Please login first.' });
        }
        const accessToken = tokenStore.get(sessionId);
        const projects = await (0, businessCentralService_1.getProjects)(accessToken);
        res.json({
            data: projects,
            count: projects.length,
        });
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({
            error: 'Failed to fetch projects',
            details: error.message,
        });
    }
});
/**
 * GET /api/project-report/data
 * Get report data for a specific project and date range
 *
 * Query params:
 * - projectNo: Project number (required)
 * - fromDate: From date in YYYY-MM-DD format (optional)
 * - toDate: To date in YYYY-MM-DD format (optional)
 *
 * Headers:
 * - x-session-id: Session ID for token lookup (required)
 */
router.get('/data', async (req, res) => {
    try {
        const sessionId = req.headers['x-session-id'];
        if (!sessionId || !tokenStore.has(sessionId)) {
            return res.status(401).json({ error: 'Not authenticated. Please login first.' });
        }
        const { projectNo, fromDate, toDate } = req.query;
        if (!projectNo) {
            return res.status(400).json({ error: 'projectNo is required' });
        }
        const accessToken = tokenStore.get(sessionId);
        const invoices = await (0, businessCentralService_1.getPurchaseInvoicesByProject)(accessToken, projectNo, fromDate, toDate);
        res.json({
            projectNo,
            fromDate: fromDate || null,
            toDate: toDate || null,
            recordCount: invoices.length,
            data: invoices,
        });
    }
    catch (error) {
        console.error('Error fetching report data:', error);
        res.status(500).json({
            error: 'Failed to fetch report data',
            details: error.message,
        });
    }
});
exports.default = router;
