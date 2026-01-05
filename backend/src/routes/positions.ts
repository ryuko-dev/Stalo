import { Router } from 'express';
import { getConnection, sql } from '../config/database';

const router = Router();

// Combined endpoint - returns all data needed for Positions page in single request
// Supports optional date filtering via query params: startMonth, endMonth (format: YYYY-MM)
router.get('/combined', async (req, res) => {
  try {
    const pool = await getConnection();
    const { startMonth, endMonth } = req.query;
    
    // Build positions query with optional date filter
    let positionsQuery = `
      SELECT p.*, pr.Name as ProjectName 
      FROM dbo.Positions p
      LEFT JOIN dbo.Projects pr ON p.Project = pr.ID
    `;
    
    // Build allocations query with optional date filter  
    let allocationsQuery = 'SELECT * FROM dbo.Allocation';
    
    // If date range is provided, filter positions and allocations by MonthYear
    // MonthYear is stored as datetime, so we compare year/month parts
    if (startMonth && endMonth) {
      const [startYear, startMon] = (startMonth as string).split('-');
      const [endYear, endMon] = (endMonth as string).split('-');
      
      positionsQuery += ` WHERE (YEAR(p.MonthYear) > ${startYear} OR (YEAR(p.MonthYear) = ${startYear} AND MONTH(p.MonthYear) >= ${startMon}))
        AND (YEAR(p.MonthYear) < ${endYear} OR (YEAR(p.MonthYear) = ${endYear} AND MONTH(p.MonthYear) <= ${endMon}))`;
      
      allocationsQuery += ` WHERE (YEAR(MonthYear) > ${startYear} OR (YEAR(MonthYear) = ${startYear} AND MONTH(MonthYear) >= ${startMon}))
        AND (YEAR(MonthYear) < ${endYear} OR (YEAR(MonthYear) = ${endYear} AND MONTH(MonthYear) <= ${endMon}))`;
    }
    
    // Execute all queries in parallel for maximum performance
    const [positionsResult, projectsResult, resourcesResult, allocationsResult] = await Promise.all([
      pool.request().query(positionsQuery),
      pool.request().query('SELECT * FROM dbo.Projects ORDER BY Name'),
      pool.request().query('SELECT * FROM dbo.Resources'),
      pool.request().query(allocationsQuery)
    ]);
    
    res.json({
      positions: positionsResult.recordset,
      projects: projectsResult.recordset,
      resources: resourcesResult.recordset,
      allocations: allocationsResult.recordset
    });
  } catch (error: any) {
    console.error('Error fetching combined positions data:', error);
    res.status(500).json({ error: 'Failed to fetch positions data', details: error.message });
  }
});

// Validate position allocations - ensure positions with Allocated='Yes' have matching allocation entries
// Optimized with batch updates for better performance
router.post('/validate-allocations', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Get all positions
    const positionsResult = await pool.request().query(`
      SELECT p.ID, p.PositionName, p.Allocated, p.Project, pr.Name as ProjectName
      FROM dbo.Positions p
      LEFT JOIN dbo.Projects pr ON p.Project = pr.ID
    `);
    
    // Get all allocations
    const allocationsResult = await pool.request().query(`
      SELECT a.ID, a.PositionID
      FROM dbo.Allocation a
    `);
    
    const positions = positionsResult.recordset;
    const allocations = allocationsResult.recordset;
    
    // Build a set of position IDs that have allocations
    const allocatedPositionIds = new Set(allocations.map(a => a.PositionID));
    
    // Track changes and collect IDs for batch updates
    const changes: { action: string; positionId: string; positionName: string; details: string }[] = [];
    const positionsToSetNo: string[] = [];
    const positionsToSetYes: string[] = [];
    
    for (const position of positions) {
      const hasAllocation = allocatedPositionIds.has(position.ID);
      
      if (position.Allocated === 'Yes' && !hasAllocation) {
        positionsToSetNo.push(position.ID);
        changes.push({
          action: 'fixed_false_allocation',
          positionId: position.ID,
          positionName: position.PositionName,
          details: `Position was marked as allocated but no allocation entry exists in dbo.Allocation - set to unallocated`
        });
      } else if (position.Allocated === 'No' && hasAllocation) {
        positionsToSetYes.push(position.ID);
        changes.push({
          action: 'fixed_missing_allocation_flag',
          positionId: position.ID,
          positionName: position.PositionName,
          details: `Position was marked as unallocated but allocation entry exists in dbo.Allocation - set to allocated`
        });
      }
    }
    
    // Batch update positions that need to be set to 'No'
    if (positionsToSetNo.length > 0) {
      await pool.request().query(`
        UPDATE dbo.Positions 
        SET Allocated = 'No' 
        WHERE ID IN ('${positionsToSetNo.join("','")}')
      `);
    }
    
    // Batch update positions that need to be set to 'Yes'
    if (positionsToSetYes.length > 0) {
      await pool.request().query(`
        UPDATE dbo.Positions 
        SET Allocated = 'Yes' 
        WHERE ID IN ('${positionsToSetYes.join("','")}')
      `);
    }
    
    res.json({
      success: true,
      totalPositions: positions.length,
      totalAllocations: allocations.length,
      changesCount: changes.length,
      changes
    });
    
  } catch (error: any) {
    console.error('Error validating position allocations:', error);
    res.status(500).json({ error: 'Failed to validate position allocations', details: error.message });
  }
});

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
    const { Project, TaskID, Fringe_Task, PositionName, MonthYear, AllocationMode, LoE, Allocated } = req.body;
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
      .input('Fringe_Task', sql.NVarChar(255), Fringe_Task || null)
      .input('PositionName', sql.NVarChar(255), PositionName)
      .input('MonthYear', sql.Date, MonthYear)
      .input('AllocationMode', sql.NVarChar(100), allocationMode)
      .input('LoE', sql.Decimal(10, 2), LoE)
      .input('Allocated', sql.NVarChar(3), Allocated || 'No')
      .query(`
        INSERT INTO dbo.Positions (Project, TaskID, Fringe_Task, PositionName, MonthYear, AllocationMode, LoE, Allocated)
        OUTPUT INSERTED.ID, INSERTED.Project, INSERTED.TaskID, INSERTED.Fringe_Task, INSERTED.PositionName, 
               INSERTED.MonthYear, INSERTED.AllocationMode, INSERTED.LoE, INSERTED.Allocated
        VALUES (@Project, @TaskID, @Fringe_Task, @PositionName, @MonthYear, @AllocationMode, @LoE, @Allocated)
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
    const { Project, TaskID, Fringe_Task, PositionName, MonthYear, AllocationMode, LoE, Allocated } = req.body;
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
      .input('Fringe_Task', sql.NVarChar(255), Fringe_Task)
      .input('PositionName', sql.NVarChar(255), PositionName)
      .input('MonthYear', sql.Date, MonthYear)
      .input('AllocationMode', sql.NVarChar(100), allocationMode)
      .input('LoE', sql.Decimal(10, 2), LoE)
      .input('Allocated', sql.NVarChar(3), Allocated)
      .query(`
        UPDATE dbo.Positions
        SET Project = COALESCE(@Project, Project),
            TaskID = COALESCE(@TaskID, TaskID),
            Fringe_Task = COALESCE(@Fringe_Task, Fringe_Task),
            PositionName = COALESCE(@PositionName, PositionName),
            MonthYear = COALESCE(@MonthYear, MonthYear),
            AllocationMode = COALESCE(@AllocationMode, AllocationMode),
            LoE = COALESCE(@LoE, LoE),
            Allocated = COALESCE(@Allocated, Allocated)
        WHERE ID = @id
      `);

    // Also update the allocation record if LoE, AllocationMode, or PositionName changed
    if (LoE !== undefined || allocationMode !== undefined || PositionName !== undefined) {
      await pool
        .request()
        .input('positionId', req.params.id)
        .input('LoE', sql.Decimal(10, 2), LoE)
        .input('AllocationMode', sql.NVarChar(100), allocationMode)
        .input('PositionName', sql.NVarChar(255), PositionName)
        .query(`
          UPDATE dbo.Allocation
          SET LoE = COALESCE(@LoE, LoE),
              AllocationMode = COALESCE(@AllocationMode, AllocationMode),
              PositionName = COALESCE(@PositionName, PositionName)
          WHERE PositionID = @positionId
        `);
    }

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

// Delete position (with confirmation support)
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const { confirm } = req.query;
    
    console.log('Attempting to delete position:', req.params.id, 'confirm:', confirm);
    
    // Get position details and allocation impact
    const impactQuery = await pool
      .request()
      .input('id', req.params.id)
      .query(`
        SELECT 
          p.ID,
          p.PositionName,
          pr.Name as ProjectName,
          (SELECT COUNT(DISTINCT a.ResourceID) 
           FROM dbo.Allocation a 
           WHERE a.PositionID = p.ID) as affectedResources,
          (SELECT COUNT(DISTINCT FORMAT(a.MonthYear, 'yyyy-MM')) 
           FROM dbo.Allocation a 
           WHERE a.PositionID = p.ID) as affectedMonths,
          (SELECT STRING_AGG(r.Name, ', ') WITHIN GROUP (ORDER BY r.Name)
           FROM dbo.Allocation a 
           INNER JOIN dbo.Resources r ON a.ResourceID = r.ID 
           WHERE a.PositionID = p.ID) as resourceNames
        FROM dbo.Positions p
        LEFT JOIN dbo.Projects pr ON p.Project = pr.ID
        WHERE p.ID = @id
      `);
    
    if (impactQuery.recordset.length === 0) {
      return res.status(404).json({ error: 'Position not found' });
    }
    
    const impact = impactQuery.recordset[0];
    console.log('Position impact:', impact);
    
    // If no confirmation provided and there are allocations, return impact info
    if (confirm !== 'true' && impact.affectedResources > 0) {
      console.log('Position has allocations, requiring confirmation');
      return res.status(200).json({
        requiresConfirmation: true,
        impact: {
          positionName: impact.PositionName,
          projectName: impact.ProjectName,
          affectedResources: impact.affectedResources,
          affectedMonths: impact.affectedMonths,
          resourceNames: impact.resourceNames,
          message: `Deleting this position will unallocate ${impact.affectedResources} resource(s) for ${impact.affectedMonths} month(s).`
        }
      });
    }
    
    console.log('Proceeding with position deletion');
    // Proceed with deletion (with cascade)
    const transaction = pool.transaction();
    await transaction.begin();
    
    try {
      // Delete allocations first (cascade)
      await transaction
        .request()
        .input('id', req.params.id)
        .query('DELETE FROM dbo.Allocation WHERE PositionID = @id');
      
      // Delete position
      const deleted = await transaction
        .request()
        .input('id', req.params.id)
        .query('DELETE FROM dbo.Positions OUTPUT DELETED.ID WHERE ID = @id');
      
      if (deleted.recordset.length === 0) {
        await transaction.rollback();
        return res.status(404).json({ error: 'Position not found' });
      }
      
      await transaction.commit();
      
      res.json({ 
        success: true, 
        message: 'Position and related allocations deleted successfully',
        allocationsDeleted: impact.affectedResources * impact.affectedMonths
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error: any) {
    console.error('Error deleting position:', error);
    res.status(500).json({ error: 'Failed to delete position', details: error.message });
  }
});

export default router;
