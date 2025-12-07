import { Router } from 'express';
import { getConnection, sql } from '../config/database';

const router = Router();

// Get all positions
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT p.*, pr.Name as ProjectName 
      FROM dbo.Positions p
      LEFT JOIN dbo.Projects pr ON p.Project = pr.ID
    `);
    res.json(result.recordset);
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions', details: error.message });
  }
});

// Get position by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input('id', req.params.id)
      .query(`
        SELECT p.*, pr.Name as ProjectName 
        FROM dbo.Positions p
        LEFT JOIN dbo.Projects pr ON p.Project = pr.ID
        WHERE p.ID = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json(result.recordset[0]);
  } catch (error: any) {
    console.error('Error fetching position:', error);
    res.status(500).json({ error: 'Failed to fetch position', details: error.message });
  }
});

// Create new position
router.post('/', async (req, res) => {
  try {
    const { Project, TaskID, PositionName, MonthYear, AllocationMode, LoE, Allocated } = req.body;
    const pool = await getConnection();

    // Get AllocationMode from Projects table if not provided
    let allocationMode = AllocationMode;
    if (!allocationMode && Project) {
      const projectResult = await pool
        .request()
        .input('projectId', Project)
        .query('SELECT AllocationMode FROM dbo.Projects WHERE ID = @projectId');
      
      if (projectResult.recordset.length > 0) {
        allocationMode = projectResult.recordset[0].AllocationMode;
      }
    }

    const result = await pool
      .request()
      .input('Project', sql.UniqueIdentifier, Project)
      .input('TaskID', sql.NVarChar(255), TaskID)
      .input('PositionName', sql.NVarChar(255), PositionName)
      .input('MonthYear', sql.Date, MonthYear)
      .input('AllocationMode', sql.NVarChar(100), allocationMode)
      .input('LoE', sql.Decimal(10, 2), LoE)
      .input('Allocated', sql.NVarChar(3), Allocated || 'No')
      .query(`
        INSERT INTO dbo.Positions (Project, TaskID, PositionName, MonthYear, AllocationMode, LoE, Allocated)
        OUTPUT INSERTED.ID, INSERTED.Project, INSERTED.TaskID, INSERTED.PositionName, 
               INSERTED.MonthYear, INSERTED.AllocationMode, INSERTED.LoE, INSERTED.Allocated
        VALUES (@Project, @TaskID, @PositionName, @MonthYear, @AllocationMode, @LoE, @Allocated)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error: any) {
    console.error('Error creating position:', error);
    res.status(500).json({ error: 'Failed to create position', details: error.message });
  }
});

// Update position
router.put('/:id', async (req, res) => {
  try {
    const { Project, TaskID, PositionName, MonthYear, AllocationMode, LoE, Allocated } = req.body;
    const pool = await getConnection();

    // Get AllocationMode from Projects table if not provided
    let allocationMode = AllocationMode;
    if (!allocationMode && Project) {
      const projectResult = await pool
        .request()
        .input('projectId', Project)
        .query('SELECT AllocationMode FROM dbo.Projects WHERE ID = @projectId');
      
      if (projectResult.recordset.length > 0) {
        allocationMode = projectResult.recordset[0].AllocationMode;
      }
    }

    await pool
      .request()
      .input('id', req.params.id)
      .input('Project', sql.UniqueIdentifier, Project)
      .input('TaskID', sql.NVarChar(255), TaskID)
      .input('PositionName', sql.NVarChar(255), PositionName)
      .input('MonthYear', sql.Date, MonthYear)
      .input('AllocationMode', sql.NVarChar(100), allocationMode)
      .input('LoE', sql.Decimal(10, 2), LoE)
      .input('Allocated', sql.NVarChar(3), Allocated)
      .query(`
        UPDATE dbo.Positions
        SET Project = COALESCE(@Project, Project),
            TaskID = COALESCE(@TaskID, TaskID),
            PositionName = COALESCE(@PositionName, PositionName),
            MonthYear = COALESCE(@MonthYear, MonthYear),
            AllocationMode = COALESCE(@AllocationMode, AllocationMode),
            LoE = COALESCE(@LoE, LoE),
            Allocated = COALESCE(@Allocated, Allocated)
        WHERE ID = @id
      `);

    const updated = await pool
      .request()
      .input('id', req.params.id)
      .query(`
        SELECT p.*, pr.Name as ProjectName 
        FROM dbo.Positions p
        LEFT JOIN dbo.Projects pr ON p.Project = pr.ID
        WHERE p.ID = @id
      `);

    if (updated.recordset.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json(updated.recordset[0]);
  } catch (error: any) {
    console.error('Error updating position:', error);
    res.status(500).json({ error: 'Failed to update position', details: error.message });
  }
});

// Delete position
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const deleted = await pool
      .request()
      .input('id', req.params.id)
      .query('DELETE FROM dbo.Positions OUTPUT DELETED.ID WHERE ID = @id');
    
    if (deleted.recordset.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting position:', error);
    res.status(500).json({ error: 'Failed to delete position', details: error.message });
  }
});

export default router;
