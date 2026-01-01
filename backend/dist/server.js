"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
// Load environment variables - try backend.env first, then .env
// Azure App Service will use Application Settings which are already in process.env
dotenv_1.default.config({ path: path_1.default.join(__dirname, '../backend.env') });
dotenv_1.default.config(); // Also try .env as fallback
const projects_1 = __importDefault(require("./routes/projects"));
const resources_1 = __importDefault(require("./routes/resources"));
const allocations_1 = __importDefault(require("./routes/allocations"));
const systemUsers_1 = __importDefault(require("./routes/systemUsers"));
const entities_1 = __importDefault(require("./routes/entities"));
const positions_1 = __importDefault(require("./routes/positions"));
const payroll_1 = __importDefault(require("./routes/payroll"));
const scheduledRecords_1 = __importDefault(require("./routes/scheduledRecords"));
const businessCentral_1 = __importDefault(require("./routes/businessCentral"));
const budget_1 = __importDefault(require("./routes/budget"));
const database_1 = require("./config/database");
const auth_1 = require("./middleware/auth");
const rbac_1 = require("./middleware/rbac");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5003;
// Trust proxy - required for Azure App Service, Heroku, etc.
// This allows Express to read X-Forwarded-* headers correctly
// Setting to 1 means trust the first proxy (Azure's load balancer)
app.set('trust proxy', 1);
// CORS configuration - restrict to known origins
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173', // Vite dev server
    process.env.FRONTEND_URL, // Production frontend URL
].filter(Boolean);
const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (same-origin requests when frontend is served from backend,
        // mobile apps, curl requests, or Azure health probes)
        if (!origin) {
            callback(null, true);
            return;
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else if (process.env.NODE_ENV !== 'production') {
            // In development, allow any origin but log it
            console.log(`⚠️ CORS: Allowing unknown origin in dev mode: ${origin}`);
            callback(null, true);
        }
        else {
            callback(new Error(`CORS: Origin ${origin} not allowed`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
// Rate limiting configuration
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // Limit each IP to 1000 requests per window
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip failing requests - don't count them toward the limit
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
});
// Stricter rate limit for auth-related endpoints
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit auth attempts
    message: { error: 'Too many authentication attempts, please try again later.' },
});
// Middleware
app.use((0, compression_1.default)()); // Enable gzip compression for all responses
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP as it may interfere with SPA
    crossOriginEmbedderPolicy: false, // Allow embedding resources
})); // Security headers
app.use((0, cors_1.default)(corsOptions));
app.use(express_1.default.json({ limit: '10mb' })); // Limit request body size
app.use('/api/', apiLimiter); // Apply rate limiting to all API routes
// Protected API Routes - require authentication and appropriate role
// Read operations require Viewer role, write operations require Editor/Admin
app.use('/api/projects', auth_1.authMiddleware, rbac_1.requireViewer, projects_1.default);
app.use('/api/resources', auth_1.authMiddleware, rbac_1.requireViewer, resources_1.default);
app.use('/api/allocations', auth_1.authMiddleware, rbac_1.requireViewer, allocations_1.default);
app.use('/api/system-users', auth_1.authMiddleware, rbac_1.requireViewer, systemUsers_1.default);
app.use('/api/entities', auth_1.authMiddleware, rbac_1.requireViewer, entities_1.default);
app.use('/api/positions', auth_1.authMiddleware, rbac_1.requireViewer, positions_1.default);
app.use('/api/payroll', auth_1.authMiddleware, rbac_1.requireViewer, payroll_1.default);
app.use('/api/scheduled-records', auth_1.authMiddleware, rbac_1.requireViewer, scheduledRecords_1.default);
app.use('/api/bc', auth_1.authMiddleware, rbac_1.requireViewer, businessCentral_1.default);
app.use('/api/budget', auth_1.authMiddleware, rbac_1.requireViewer, budget_1.default);
// Health check - public (for load balancers and monitoring)
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// ============================================================================
// Debug/Admin endpoints - protected and restricted to development or admin only
// ============================================================================
// Environment debug endpoint - only in development
if (process.env.NODE_ENV !== 'production') {
    app.get('/api/env-check', (req, res) => {
        res.json({
            DB_SERVER: process.env.DB_SERVER ? '✓ Set' : '✗ Missing',
            DB_DATABASE: process.env.DB_DATABASE ? '✓ Set' : '✗ Missing',
            DB_USER: process.env.DB_USER ? '✓ Set' : '✗ Missing',
            DB_PASSWORD: process.env.DB_PASSWORD ? '✓ Set (hidden)' : '✗ Missing',
            PORT: process.env.PORT || 'Using default',
            NODE_ENV: process.env.NODE_ENV || 'Not set',
            AUTH_CONFIGURED: process.env.MSAL_TENANT_ID ? '✓ Set' : '✗ Missing',
        });
    });
    // Check database indexes - development only
    app.get('/api/check-indexes', async (req, res) => {
        try {
            const connection = await (0, database_1.getConnection)();
            const result = await connection.request().query(`
        SELECT 
          t.name AS TableName,
          i.name AS IndexName,
          i.type_desc AS IndexType
        FROM sys.indexes i
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name IN ('Positions', 'Allocation', 'Resources')
        AND i.name IS NOT NULL
        ORDER BY t.name, i.name
      `);
            res.json({
                indexCount: result.recordset.length,
                indexes: result.recordset
            });
        }
        catch (error) {
            console.error('Error checking indexes:', error);
            res.status(500).json({ error: 'Failed to check indexes' });
        }
    });
    // Create performance indexes - development only (protected operation)
    app.post('/api/create-indexes', auth_1.authMiddleware, rbac_1.requireAdmin, async (req, res) => {
        try {
            const connection = await (0, database_1.getConnection)();
            const indexStatements = [
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Positions_Project') CREATE INDEX IX_Positions_Project ON dbo.Positions(Project)",
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Positions_MonthYear') CREATE INDEX IX_Positions_MonthYear ON dbo.Positions(MonthYear)",
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Positions_Allocated') CREATE INDEX IX_Positions_Allocated ON dbo.Positions(Allocated)",
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_PositionID') CREATE INDEX IX_Allocation_PositionID ON dbo.Allocation(PositionID)",
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_ResourceID') CREATE INDEX IX_Allocation_ResourceID ON dbo.Allocation(ResourceID)",
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_ProjectID') CREATE INDEX IX_Allocation_ProjectID ON dbo.Allocation(ProjectID)",
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_MonthYear') CREATE INDEX IX_Allocation_MonthYear ON dbo.Allocation(MonthYear)",
                "IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Resources_Entity') CREATE INDEX IX_Resources_Entity ON dbo.Resources(Entity)"
            ];
            const results = [];
            for (const stmt of indexStatements) {
                try {
                    await connection.request().query(stmt);
                    const indexName = stmt.match(/IX_\w+/)?.[0] || 'Unknown';
                    results.push(`Created: ${indexName}`);
                }
                catch (err) {
                    const indexName = stmt.match(/IX_\w+/)?.[0] || 'Unknown';
                    results.push(`Failed ${indexName}: ${err.message}`);
                }
            }
            res.json({ success: true, results });
        }
        catch (error) {
            console.error('Error creating indexes:', error);
            res.status(500).json({ error: 'Failed to create indexes' });
        }
    });
    // Test database connection - development only
    app.get('/api/db-test', async (req, res) => {
        try {
            const connection = await (0, database_1.getConnection)();
            const result = await connection.request().query('SELECT 1 as test');
            res.json({ status: 'Database connected successfully', result: result.recordset });
        }
        catch (error) {
            console.error('Database connection error:', error);
            res.status(500).json({ error: 'Database connection failed' });
        }
    });
} // End of development-only endpoints
// Serve static frontend files in production
const publicPath = path_1.default.join(__dirname, '../public');
app.use(express_1.default.static(publicPath));
// Handle client-side routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
    // Don't serve index.html for API routes
    if (!req.path.startsWith('/api')) {
        res.sendFile(path_1.default.join(publicPath, 'index.html'));
    }
});
// Start server
const server = app.listen(PORT, async () => {
    console.log(`🚀 Stalo backend server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 Authentication: ${process.env.MSAL_TENANT_ID ? 'Enabled' : 'Disabled (MSAL_TENANT_ID not set)'}`);
    console.log(`Serving static files from: ${publicPath}`);
    // Check database connection on startup
    try {
        console.log('Checking database connection...');
        const connection = await (0, database_1.getConnection)();
        console.log('✅ Database connection successful');
    }
    catch (error) {
        console.error('❌ Database connection failed on startup:', error);
    }
});
server.on('error', (error) => {
    console.error('Server error:', error);
});
server.on('close', () => {
    console.error('Server closed unexpectedly');
});
process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
});
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
