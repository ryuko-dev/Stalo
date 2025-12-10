import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import projectsRouter from './routes/projects';
import resourcesRouter from './routes/resources';
import allocationsRouter from './routes/allocations';
import systemUsersRouter from './routes/systemUsers';
import entitiesRouter from './routes/entities';
import positionsRouter from './routes/positions';
import { getConnection } from './config/database';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/projects', projectsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/allocations', allocationsRouter);
app.use('/api/system-users', systemUsersRouter);
app.use('/api/entities', entitiesRouter);
app.use('/api/positions', positionsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stalo backend server running on port ${PORT}`);
});
