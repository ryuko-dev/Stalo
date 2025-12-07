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
app.use(express.json({ limit: '10mb' }));

// Error handling middleware for JSON parsing errors
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    console.error('JSON parsing error:', err);
    console.error('Raw body that failed to parse:', req.body);
    return res.status(400).json({ 
      error: 'Invalid JSON format', 
      details: err.message,
      receivedBody: req.body 
    });
  }
  next();
});

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
    // Temporarily disable database test
    res.json({ status: 'Database test disabled for debugging' });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stalo backend server running on port ${PORT}`);
});
