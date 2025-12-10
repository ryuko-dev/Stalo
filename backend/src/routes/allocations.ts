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
    const { PositionID, ResourceName, MonthYear, AllocationMode, LoE, ProjectName, PositionName } = req.body;
    
    const pool = await getConnection();

    // Handle drag-and-drop case (PositionID provided)
    if (PositionID) {
      if (!PositionID || !ResourceName || !MonthYear) {
        return res.status(400).json({ error: 'Missing required fields: PositionID, ResourceName, MonthYear' });
      }

      // Get the resource ID from name
      const resourceResult = await pool
        .request()
        .input('ResourceName', ResourceName)
        .query('SELECT ID FROM dbo.Resources WHERE Name = @ResourceName');

      // Get the position details using PositionID
      const positionResult = await pool
        .request()
        .input('PositionID', PositionID)
        .query('SELECT ID, Project as ProjectID, PositionName FROM dbo.Positions WHERE ID = @PositionID');

      if (resourceResult.recordset.length === 0 || positionResult.recordset.length === 0) {
        return res.status(400).json({ 
          error: 'Invalid reference data',
          details: {
            resourceFound: resourceResult.recordset.length > 0,
            positionFound: positionResult.recordset.length > 0
          }
        });
      }

      const resourceId = resourceResult.recordset[0].ID;
      const positionId = positionResult.recordset[0].ID;
      const projectId = positionResult.recordset[0].ProjectID;
      const positionName = positionResult.recordset[0].PositionName;

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
        .input('PositionName', sql.NVarChar(200), positionName)
        .input('MonthYear', sql.Date, MonthYear)
        .input('AllocationMode', sql.NVarChar(10), AllocationMode || '%')
        .input('LoE', sql.Decimal(18, 2), LoE)
        .query(`
          INSERT INTO dbo.Allocation (ProjectID, ResourceID, PositionID, PositionName, MonthYear, AllocationMode, LoE)
          OUTPUT INSERTED.*
          VALUES (@ProjectID, @ResourceID, @PositionID, @PositionName, @MonthYear, @AllocationMode, @LoE)
        `);

      res.status(201).json(result.recordset[0]);
      return;
    }

    // Handle original click case (ProjectName and PositionName provided)
    if (!ProjectName || !ResourceName || !PositionName || !MonthYear) {
      return res.status(400).json({ error: 'Missing required fields: ProjectName, ResourceName, PositionName, MonthYear' });
    }

    // Get the IDs from names
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

// Validate and fix position allocations for given months
// This ensures all positions for displayed months appear exactly once
router.post('/validate-positions', async (req, res) => {
  try {
    const { monthYears } = req.body; // Array of MonthYear values from the frontend
    
    if (!monthYears || !Array.isArray(monthYears) || monthYears.length === 0) {
      return res.status(400).json({ error: 'monthYears array is required' });
    }

    const pool = await getConnection();
    
    // Get all positions for the given months
    const positionsResult = await pool.request().query(`
      SELECT p.ID, p.Project, p.PositionName, p.MonthYear, p.Allocated, p.LoE, p.AllocationMode, pr.Name as ProjectName
      FROM dbo.Positions p
      LEFT JOIN dbo.Projects pr ON p.Project = pr.ID
      WHERE CONVERT(VARCHAR(7), p.MonthYear, 120) IN (${monthYears.map((m: string) => `'${m.substring(0, 7)}'`).join(',')})
    `);
    
    // Get all allocations for the given months with project info
    const allocationsResult = await pool.request().query(`
      SELECT a.ID, a.PositionID, a.ResourceID, a.ProjectID, a.MonthYear, pr.Name as ProjectName
      FROM dbo.Allocation a
      LEFT JOIN dbo.Projects pr ON a.ProjectID = pr.ID
      WHERE CONVERT(VARCHAR(7), a.MonthYear, 120) IN (${monthYears.map((m: string) => `'${m.substring(0, 7)}'`).join(',')})
    `);
    
    const positions = positionsResult.recordset;
    const allocations = allocationsResult.recordset;
    
    // Track changes made
    const changes: { action: string; positionId: string; positionName: string; details: string }[] = [];
    
    // Build a map of positionId -> position for quick lookup
    const positionMap = new Map<string, any>();
    for (const position of positions) {
      positionMap.set(position.ID, position);
    }
    
    // Build a map of positionId -> allocations (to detect duplicates)
    const positionAllocations = new Map<string, any[]>();
    for (const allocation of allocations) {
      const key = allocation.PositionID;
      if (!positionAllocations.has(key)) {
        positionAllocations.set(key, []);
      }
      positionAllocations.get(key)!.push(allocation);
    }
    
    // First pass: Check for mismatched allocations (allocation.ProjectID != position.Project)
    // These are orphaned/corrupt allocations that point to wrong positions
    for (const allocation of allocations) {
      const position = positionMap.get(allocation.PositionID);
      
      if (position && position.Project !== allocation.ProjectID) {
        // Mismatch! This allocation points to a position from a different project
        // Delete the allocation
        await pool
          .request()
          .input('id', allocation.ID)
          .query('DELETE FROM dbo.Allocation WHERE ID = @id');
        
        changes.push({
          action: 'deleted_mismatched',
          positionId: allocation.PositionID,
          positionName: position.PositionName,
          details: `Removed allocation ${allocation.ID} - ProjectID mismatch (allocation project: ${allocation.ProjectName}, position project: ${position.ProjectName})`
        });
        
        // Remove from positionAllocations map so it's not processed again
        const allocs = positionAllocations.get(allocation.PositionID) || [];
        const idx = allocs.findIndex(a => a.ID === allocation.ID);
        if (idx !== -1) allocs.splice(idx, 1);
      }
    }
    
    // Check each position
    for (const position of positions) {
      const positionAllocs = positionAllocations.get(position.ID) || [];
      
      if (positionAllocs.length > 1) {
        // DUPLICATE: Position allocated multiple times - keep first, delete rest, mark as unallocated
        const [keepAllocation, ...duplicateAllocations] = positionAllocs;
        
        for (const dupAlloc of duplicateAllocations) {
          // Delete duplicate allocation
          await pool
            .request()
            .input('id', dupAlloc.ID)
            .query('DELETE FROM dbo.Allocation WHERE ID = @id');
          
          changes.push({
            action: 'deleted_duplicate',
            positionId: position.ID,
            positionName: position.PositionName,
            details: `Removed duplicate allocation ${dupAlloc.ID}`
          });
        }
        
        // Mark position as unallocated and delete the kept allocation too
        await pool
          .request()
          .input('id', keepAllocation.ID)
          .query('DELETE FROM dbo.Allocation WHERE ID = @id');
        
        await pool
          .request()
          .input('positionId', position.ID)
          .query("UPDATE dbo.Positions SET Allocated = 'No' WHERE ID = @positionId");
        
        changes.push({
          action: 'moved_to_unallocated',
          positionId: position.ID,
          positionName: position.PositionName,
          details: 'Position had duplicates, moved to unallocated section'
        });
        
      } else if (positionAllocs.length === 1) {
        // Position is allocated exactly once - ensure Allocated = 'Yes'
        if (position.Allocated !== 'Yes') {
          await pool
            .request()
            .input('positionId', position.ID)
            .query("UPDATE dbo.Positions SET Allocated = 'Yes' WHERE ID = @positionId");
          
          changes.push({
            action: 'fixed_allocated_status',
            positionId: position.ID,
            positionName: position.PositionName,
            details: 'Set Allocated to Yes (was allocated but status was incorrect)'
          });
        }
        
      } else {
        // Position has no allocation - ensure it's marked as unallocated
        if (position.Allocated !== 'No') {
          await pool
            .request()
            .input('positionId', position.ID)
            .query("UPDATE dbo.Positions SET Allocated = 'No' WHERE ID = @positionId");
          
          changes.push({
            action: 'fixed_unallocated_status',
            positionId: position.ID,
            positionName: position.PositionName,
            details: 'Set Allocated to No (was not allocated but status was incorrect)'
          });
        }
      }
    }
    
    // Also check for orphaned allocations (allocations pointing to non-existent positions)
    const positionIds = new Set(positions.map(p => p.ID));
    for (const allocation of allocations) {
      if (!positionIds.has(allocation.PositionID)) {
        // Check if position exists at all in the database
        const posCheck = await pool
          .request()
          .input('positionId', allocation.PositionID)
          .query('SELECT ID FROM dbo.Positions WHERE ID = @positionId');
        
        if (posCheck.recordset.length === 0) {
          // Position doesn't exist at all - orphaned allocation, delete it
          await pool
            .request()
            .input('id', allocation.ID)
            .query('DELETE FROM dbo.Allocation WHERE ID = @id');
          
          changes.push({
            action: 'deleted_orphan',
            positionId: allocation.PositionID,
            positionName: 'Unknown',
            details: `Removed orphaned allocation ${allocation.ID} pointing to non-existent position`
          });
        }
      }
    }
    
    res.json({
      success: true,
      totalPositions: positions.length,
      totalAllocations: allocations.length,
      changesCount: changes.length,
      changes
    });
    
  } catch (error: any) {
    console.error('Error validating positions:', error);
    res.status(500).json({ error: 'Failed to validate positions', details: error.message });
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

    // Update the position's Allocated status back to 'No' using PositionID
    await pool
      .request()
      .input('PositionID', allocation.PositionID)
      .query('UPDATE dbo.Positions SET Allocated = \'No\' WHERE ID = @PositionID');
    
    res.json({ success: true, message: 'Allocation deleted and position updated' });
  } catch (error: any) {
    console.error('Error deleting allocation:', error);
    res.status(500).json({ error: 'Failed to delete allocation', details: error.message });
  }
});

export default router;
