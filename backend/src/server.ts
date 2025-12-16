import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';

// Load backend.env specifically
dotenv.config({ path: path.join(__dirname, '../backend.env') });
import projectsRouter from './routes/projects';
import resourcesRouter from './routes/resources';
import allocationsRouter from './routes/allocations';
import systemUsersRouter from './routes/systemUsers';
import entitiesRouter from './routes/entities';
import positionsRouter from './routes/positions';
import payrollRouter from './routes/payroll';
import scheduledRecordsRouter from './routes/scheduledRecords';
import { getConnection } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

// Middleware
app.use(compression()); // Enable gzip compression for all responses
app.use(cors());
app.use(express.json());

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../frontend/dist')));
}

// API Routes
app.use('/api/projects', projectsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/system-users', systemUsersRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/scheduled-records', scheduledRecordsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check database indexes
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to check indexes', details: errorMessage });
  }
});

// Create performance indexes (run once)
app.post('/api/create-indexes', async (req, res) => {
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: 'Failed to create indexes', details: errorMessage });
  }
});

// Test database connection
app.get('/api/db-test', async (req, res) => {
  try {
    const connection = await getConnection();
    const result = await connection.request().query('SELECT 1 as test');
    res.json({ status: 'Database connected successfully', result: result.recordset });
  } catch (error) {
    console.error('Database connection error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
    res.status(500).json({ error: 'Database connection failed', details: errorMessage });
  }
});

// Frontend fallback route for SPA routing
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
  });
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Stalo backend server running on port ${PORT}`);
  console.log(`Server listening: ${server.listening}`);
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
