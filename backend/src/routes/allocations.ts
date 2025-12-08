import { Router } from 'express';
import { getConnection, sql } from '../config/database';

const router = Router();

// Get all allocations
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT 
        a.ID,
        a.ProjectID,
        a.ResourceID,
        a.PositionID,
        a.MonthYear,
        a.AllocationMode,
        a.LoE,
        p.Name as ProjectName,
        pos.PositionName,
        r.Name as ResourceName
      FROM dbo.Allocation a
      LEFT JOIN dbo.Projects p ON a.ProjectID = p.ID
      LEFT JOIN dbo.Positions pos ON a.PositionID = pos.ID
      LEFT JOIN dbo.Resources r ON a.ResourceID = r.ID
    `);
    res.json(result.recordset);
  } catch (error: any) {
    console.error('Error fetching allocations:', error);
    res.status(500).json({ error: 'Failed to fetch allocations', details: error.message });
  }
});

// Create new allocation
router.post('/', async (req, res) => {
  try {
    const { ProjectName, ResourceName, PositionName, MonthYear, AllocationMode, LoE } = req.body;
    
    const pool = await getConnection();

    if (!ProjectName || !ResourceName || !PositionName || !MonthYear) {
      return res.status(400).json({ error: 'Missing required fields: ProjectName, ResourceName, PositionName, MonthYear' });
    }

    // Get the IDs from the names
    const projectResult = await pool
      .request()
      .input('ProjectName', ProjectName)
      .query('SELECT ID FROM dbo.Projects WHERE Name = @ProjectName');

    const resourceResult = await pool
      .request()
      .input('ResourceName', ResourceName)
      .query('SELECT ID FROM dbo.Resources WHERE Name = @ResourceName');

    const positionResult = await pool
      .request()
      .input('PositionName', PositionName)
      .input('MonthYear', MonthYear)
      .query('SELECT ID FROM dbo.Positions WHERE PositionName = @PositionName AND MonthYear = @MonthYear');

    if (projectResult.recordset.length === 0 || resourceResult.recordset.length === 0 || positionResult.recordset.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid reference data',
        details: {
          projectFound: projectResult.recordset.length > 0,
          resourceFound: resourceResult.recordset.length > 0,
          positionFound: positionResult.recordset.length > 0
        }
      });
    }

    const projectId = projectResult.recordset[0].ID;
    const resourceId = resourceResult.recordset[0].ID;
    const positionId = positionResult.recordset[0].ID;

    // Update the position's Allocated status to 'Yes'
    await pool
      .request()
      .input('positionId', positionId)
      .query('UPDATE dbo.Positions SET Allocated = \'Yes\' WHERE ID = @positionId');

    // Create the allocation with the correct schema (using IDs)
    const result = await pool
      .request()
      .input('ProjectID', sql.UniqueIdentifier, projectId)
      .input('ResourceID', sql.UniqueIdentifier, resourceId)
      .input('PositionID', sql.UniqueIdentifier, positionId)
      .input('PositionName', sql.NVarChar(200), PositionName)
      .input('MonthYear', sql.Date, MonthYear)
      .input('AllocationMode', sql.NVarChar(10), AllocationMode)
      .input('LoE', sql.Decimal(18, 2), LoE)
      .query(`
        INSERT INTO dbo.Allocation (ProjectID, ResourceID, PositionID, PositionName, MonthYear, AllocationMode, LoE)
        OUTPUT INSERTED.*
        VALUES (@ProjectID, @ResourceID, @PositionID, @PositionName, @MonthYear, @AllocationMode, @LoE)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error: any) {
    console.error('Error creating allocation:', error);
    res.status(500).json({ error: 'Failed to create allocation', details: error.message });
  }
});

// Update allocation
router.put('/:id', async (req, res) => {
  try {
    const { ProjectName, ResourceName, PositionName, MonthYear, AllocationMode, LoE } = req.body;
    const pool = await getConnection();

    await pool
      .request()
      .input('id', req.params.id)
      .input('ProjectName', sql.NVarChar(200), ProjectName)
      .input('ResourceName', sql.NVarChar(200), ResourceName)
      .input('PositionName', sql.NVarChar(200), PositionName)
      .input('MonthYear', sql.Date, MonthYear)
      .input('AllocationMode', sql.NVarChar(10), AllocationMode)
      .input('LoE', sql.Decimal(18, 2), LoE)
      .query(`
        UPDATE dbo.Allocation
        SET ProjectName = COALESCE(@ProjectName, ProjectName),
            ResourceName = COALESCE(@ResourceName, ResourceName),
            PositionName = COALESCE(@PositionName, PositionName),
            MonthYear = COALESCE(@MonthYear, MonthYear),
            AllocationMode = COALESCE(@AllocationMode, AllocationMode),
            LoE = COALESCE(@LoE, LoE)
        WHERE ID = @id
      `);

    const updated = await pool
      .request()
      .input('id', req.params.id)
      .query('SELECT * FROM dbo.Allocation WHERE ID = @id');

    if (updated.recordset.length === 0) {
      return res.status(404).json({ error: 'Allocation not found' });
    }
    res.json(updated.recordset[0]);
  } catch (error: any) {
    console.error('Error updating allocation:', error);
    res.status(500).json({ error: 'Failed to update allocation', details: error.message });
  }
});

// Delete allocation
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getConnection();

    // Get the allocation details before deleting to find the position
    const allocationResult = await pool
      .request()
      .input('id', id)
      .query('SELECT * FROM dbo.Allocation WHERE ID = @id');

    if (allocationResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Allocation not found' });
    }

    const allocation = allocationResult.recordset[0];

    // Delete the allocation
    await pool
      .request()
      .input('id', id)
      .query('DELETE FROM dbo.Allocation WHERE ID = @id');

    // Update the position's Allocated status back to 'No'
    await pool
      .request()
      .input('PositionName', allocation.PositionName)
      .input('MonthYear', allocation.MonthYear)
      .query('UPDATE dbo.Positions SET Allocated = \'No\' WHERE PositionName = @PositionName AND MonthYear = @MonthYear');
    
    res.json({ success: true, message: 'Allocation deleted and position updated' });
  } catch (error: any) {
    console.error('Error deleting allocation:', error);
    res.status(500).json({ error: 'Failed to delete allocation', details: error.message });
  }
});

export default router;
