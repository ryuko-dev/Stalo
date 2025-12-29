import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables - try backend.env first, then .env
// Azure App Service will use Application Settings which are already in process.env
dotenv.config({ path: path.join(__dirname, '../backend.env') });
dotenv.config(); // Also try .env as fallback

import projectsRouter from './routes/projects';
import resourcesRouter from './routes/resources';
import allocationsRouter from './routes/allocations';
import systemUsersRouter from './routes/systemUsers';
import entitiesRouter from './routes/entities';
import positionsRouter from './routes/positions';
import payrollRouter from './routes/payroll';
import scheduledRecordsRouter from './routes/scheduledRecords';
import businessCentralRouter from './routes/businessCentral';
import budgetRouter from './routes/budget';
import { getConnection } from './config/database';
import { authMiddleware } from './middleware/auth';
import { requireViewer, requireEditor, requireAdmin } from './middleware/rbac';

const app = express();
const PORT = process.env.PORT || 5003;

// Trust proxy - required for Azure App Service, Heroku, etc.
// This allows Express to read X-Forwarded-* headers correctly
app.set('trust proxy', true);

// CORS configuration - restrict to known origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173', // Vite dev server
  process.env.FRONTEND_URL, // Production frontend URL
].filter(Boolean);

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin requests when frontend is served from backend,
    // mobile apps, curl requests, or Azure health probes)
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV !== 'production') {
      // In development, allow any origin but log it
      console.log(`⚠️ CORS: Allowing unknown origin in dev mode: ${origin}`);
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Rate limiting configuration
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limit for auth-related endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit auth attempts
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// Middleware
app.use(compression()); // Enable gzip compression for all responses
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP as it may interfere with SPA
  crossOriginEmbedderPolicy: false, // Allow embedding resources
})); // Security headers
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Limit request body size
app.use('/api/', apiLimiter); // Apply rate limiting to all API routes

// Protected API Routes - require authentication and appropriate role
// Read operations require Viewer role, write operations require Editor/Admin
app.use('/api/projects', authMiddleware, requireViewer, projectsRouter);
app.use('/api/resources', authMiddleware, requireViewer, resourcesRouter);
app.use('/api/allocations', authMiddleware, requireViewer, allocationsRouter);
app.use('/api/system-users', authMiddleware, requireViewer, systemUsersRouter);
app.use('/api/entities', authMiddleware, requireViewer, entitiesRouter);
app.use('/api/positions', authMiddleware, requireViewer, positionsRouter);
app.use('/api/payroll', authMiddleware, requireViewer, payrollRouter);
app.use('/api/scheduled-records', authMiddleware, requireViewer, scheduledRecordsRouter);
app.use('/api/bc', authMiddleware, requireViewer, businessCentralRouter);
app.use('/api/budget', authMiddleware, requireViewer, budgetRouter);

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
      const connection = await getConnection();
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
    } catch (error) {
      console.error('Error checking indexes:', error);
      res.status(500).json({ error: 'Failed to check indexes' });
    }
  });

  // Create performance indexes - development only (protected operation)
  app.post('/api/create-indexes', authMiddleware, requireAdmin, async (req, res) => {
    try {
      const connection = await getConnection();
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
      
      const results: string[] = [];
      for (const stmt of indexStatements) {
        try {
          await connection.request().query(stmt);
          const indexName = stmt.match(/IX_\w+/)?.[0] || 'Unknown';
          results.push(`Created: ${indexName}`);
        } catch (err: any) {
          const indexName = stmt.match(/IX_\w+/)?.[0] || 'Unknown';
          results.push(`Failed ${indexName}: ${err.message}`);
        }
      }
      
      res.json({ success: true, results });
    } catch (error) {
      console.error('Error creating indexes:', error);
      res.status(500).json({ error: 'Failed to create indexes' });
    }
  });

  // Test database connection - development only
  app.get('/api/db-test', async (req, res) => {
    try {
      const connection = await getConnection();
      const result = await connection.request().query('SELECT 1 as test');
      res.json({ status: 'Database connected successfully', result: result.recordset });
    } catch (error) {
      console.error('Database connection error:', error);
      res.status(500).json({ error: 'Database connection failed' });
    }
  });
} // End of development-only endpoints

// Serve static frontend files in production
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Handle client-side routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'));
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
    const connection = await getConnection();
    console.log('✅ Database connection successful');
  } catch (error) {
    console.error('❌ Database connection failed on startup:', error);
  }
});

server.on('error', (error: any) => {
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
