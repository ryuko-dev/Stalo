import { Router } from 'express';
import { getConnection, sql } from '../config/database';

const router = Router();

// Get all resources
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query(`
      SELECT r.*, e.Name as EntityName 
      FROM dbo.Resources r
      LEFT JOIN dbo.Entities e ON r.Entity = e.ID
    `);
    res.json(result.recordset);
  } catch (error: any) {
    console.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Failed to fetch resources', details: error.message });
  }
});

// Get resource by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input('id', req.params.id)
      .query(`
        SELECT r.*, e.Name as EntityName 
        FROM dbo.Resources r
        LEFT JOIN dbo.Entities e ON r.Entity = e.ID
        WHERE r.ID = @id
      `);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error: any) {
    console.error('Error fetching resource:', error);
    res.status(500).json({ error: 'Failed to fetch resource', details: error.message });
  }
});

// Create new resource
router.post('/', async (req, res) => {
  try {
    const { Name, ResourceType, Entity, DynamicsVendorAcc, StartDate, EndDate, WorkDays, Department } = req.body;
    const pool = await getConnection();

    // If Entity is a name (not a GUID), find the entity ID
    let entityId = Entity;
    if (Entity && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(Entity)) {
      const entityResult = await pool
        .request()
        .input('EntityName', sql.NVarChar(200), Entity)
        .query('SELECT ID FROM dbo.Entities WHERE Name = @EntityName');
      
      if (entityResult.recordset.length === 0) {
        return res.status(400).json({ error: 'Entity not found', details: `No entity found with name: ${Entity}` });
      }
      
      entityId = entityResult.recordset[0].ID;
    }

    const result = await pool
      .request()
      .input('Name', sql.NVarChar(200), Name)
      .input('ResourceType', sql.NVarChar(20), ResourceType)
      .input('Entity', sql.UniqueIdentifier, entityId)
      .input('DynamicsVendorAcc', sql.NVarChar(100), DynamicsVendorAcc || null)
      .input('StartDate', sql.Date, StartDate)
      .input('EndDate', EndDate ? sql.Date : sql.Date, EndDate || null)
      .input('WorkDays', sql.NVarChar(20), WorkDays)
      .input('Department', sql.NVarChar(200), Department)
      .query(`
        INSERT INTO dbo.Resources (Name, ResourceType, Entity, DynamicsVendorAcc, StartDate, EndDate, WorkDays, Department)
        OUTPUT INSERTED.ID, INSERTED.Name, INSERTED.ResourceType, INSERTED.Entity, 
               INSERTED.DynamicsVendorAcc, INSERTED.StartDate, INSERTED.EndDate, 
               INSERTED.WorkDays, INSERTED.Department
        VALUES (@Name, @ResourceType, @Entity, @DynamicsVendorAcc, @StartDate, @EndDate, @WorkDays, @Department)
      `);

    res.status(201).json(result.recordset[0]);
  } catch (error: any) {
    console.error('Error creating resource:', error);
    res.status(500).json({ error: 'Failed to create resource', details: error.message });
  }
});

// Update resource
router.put('/:id', async (req, res) => {
  try {
    const { Name, ResourceType, Entity, DynamicsVendorAcc, StartDate, EndDate, WorkDays, Department } = req.body;
    const pool = await getConnection();

    await pool
      .request()
      .input('id', req.params.id)
      .input('Name', sql.NVarChar(200), Name)
      .input('ResourceType', sql.NVarChar(20), ResourceType)
      .input('Entity', sql.UniqueIdentifier, Entity)
      .input('DynamicsVendorAcc', sql.NVarChar(100), DynamicsVendorAcc || null)
      .input('StartDate', sql.Date, StartDate)
      .input('EndDate', EndDate !== undefined ? (EndDate ? sql.Date : sql.Date) : sql.Date, EndDate !== undefined ? (EndDate || null) : null)
      .input('WorkDays', sql.NVarChar(20), WorkDays)
      .input('Department', sql.NVarChar(200), Department)
      .query(`
        UPDATE dbo.Resources
        SET Name = COALESCE(@Name, Name),
            ResourceType = COALESCE(@ResourceType, ResourceType),
            Entity = COALESCE(@Entity, Entity),
            DynamicsVendorAcc = COALESCE(@DynamicsVendorAcc, DynamicsVendorAcc),
            StartDate = COALESCE(@StartDate, StartDate),
            EndDate = CASE WHEN @EndDate IS NOT NULL THEN @EndDate ELSE EndDate END,
            WorkDays = COALESCE(@WorkDays, WorkDays),
            Department = COALESCE(@Department, Department)
        WHERE ID = @id
      `);

    const updated = await pool
      .request()
      .input('id', req.params.id)
      .query(`
        SELECT r.*, e.Name as EntityName 
        FROM dbo.Resources r
        LEFT JOIN dbo.Entities e ON r.Entity = e.ID
        WHERE r.ID = @id
      `);

    if (updated.recordset.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    res.json(updated.recordset[0]);
  } catch (error: any) {
    console.error('Error updating resource:', error);
    res.status(500).json({ error: 'Failed to update resource', details: error.message });
  }
});

// Delete resource
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    
    console.log('Attempting to delete resource:', req.params.id);
    
    // Check if resource has any allocations
    const allocCheck = await pool
      .request()
      .input('id', req.params.id)
      .query(`
        SELECT 
          COUNT(*) as count, 
          STRING_AGG(p.PositionName + ' (' + FORMAT(a.MonthYear, 'yyyy-MM') + ')', ', ') WITHIN GROUP (ORDER BY a.MonthYear) as positions
        FROM dbo.Allocation a
        INNER JOIN dbo.Positions p ON a.PositionID = p.ID
        INNER JOIN dbo.Projects pr ON p.Project = pr.ID
        WHERE a.ResourceID = @id
      `);
    
    console.log('Resource allocation check:', allocCheck.recordset[0]);
    
    if (allocCheck.recordset[0].count > 0) {
      console.log('Resource has allocations, blocking deletion');
      return res.status(400).json({ 
        error: 'Cannot delete resource with active allocations',
        details: `This resource is allocated to: ${allocCheck.recordset[0].positions || 'positions'}`,
        allocationsCount: allocCheck.recordset[0].count
      });
    }
    
    console.log('Resource has no allocations, proceeding with deletion');
    const deleted = await pool
      .request()
      .input('id', req.params.id)
      .query('DELETE FROM dbo.Resources OUTPUT DELETED.ID WHERE ID = @id');
    
    if (deleted.recordset.length === 0) {
      return res.status(404).json({ error: 'Resource not found' });
    }
    
    console.log('Resource deleted successfully');
    res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting resource:', error);
    res.status(500).json({ error: 'Failed to delete resource', details: error.message });
  }
});

export default router;
