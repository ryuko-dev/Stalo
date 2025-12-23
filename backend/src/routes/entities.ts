import { Router } from 'express';
import { getConnection, sql } from '../config/database';

const router = Router();

// Get all entities
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT ID, Name, CurrencyCode, SSAccCode, TaxAccCode, SSExpCode, TaxExpCode, SalExpCode FROM dbo.Entities ORDER BY Name');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching entities:', error);
    res.status(500).json({ error: 'Failed to fetch entities' });
  }
});

// Get entity by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().input('id', req.params.id).query('SELECT ID, Name, CurrencyCode, SSAccCode, TaxAccCode, SSExpCode, TaxExpCode, SalExpCode FROM dbo.Entities WHERE ID = @id');
    if (result.recordset.length === 0) return res.status(404).json({ error: 'Entity not found' });
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching entity:', error);
    res.status(500).json({ error: 'Failed to fetch entity' });
  }
});

// Create entity
router.post('/', async (req, res) => {
  try {
    const { Name, CurrencyCode, SSAccCode, TaxAccCode, SSExpCode, TaxExpCode, SalExpCode } = req.body;
    const pool = await getConnection();
    
    // Try to create with new fields first
    try {
      const result = await pool
        .request()
        .input('Name', sql.NVarChar(255), Name)
        .input('CurrencyCode', sql.NVarChar(10), CurrencyCode)
        .input('SSAccCode', sql.NVarChar(50), SSAccCode)
        .input('TaxAccCode', sql.NVarChar(50), TaxAccCode)
        .input('SSExpCode', sql.NVarChar(100), SSExpCode || null)
        .input('TaxExpCode', sql.NVarChar(100), TaxExpCode || null)
        .input('SalExpCode', sql.NVarChar(100), SalExpCode || null)
        .query(`INSERT INTO dbo.Entities (Name, CurrencyCode, SSAccCode, TaxAccCode, SSExpCode, TaxExpCode, SalExpCode)
                OUTPUT INSERTED.ID, INSERTED.Name, INSERTED.CurrencyCode, INSERTED.SSAccCode, INSERTED.TaxAccCode, INSERTED.SSExpCode, INSERTED.TaxExpCode, INSERTED.SalExpCode
                VALUES (@Name, @CurrencyCode, @SSAccCode, @TaxAccCode, @SSExpCode, @TaxExpCode, @SalExpCode)`);

      res.status(201).json(result.recordset[0]);
    } catch (createError) {
      // If new fields don't exist, fall back to old behavior
      console.log('New fields not found in database, using fallback create');
      const result = await pool
        .request()
        .input('Name', sql.NVarChar(255), Name)
        .input('CurrencyCode', sql.NVarChar(10), CurrencyCode)
        .input('SSAccCode', sql.NVarChar(50), SSAccCode)
        .input('TaxAccCode', sql.NVarChar(50), TaxAccCode)
        .query(`INSERT INTO dbo.Entities (Name, CurrencyCode, SSAccCode, TaxAccCode)
                OUTPUT INSERTED.ID, INSERTED.Name, INSERTED.CurrencyCode, INSERTED.SSAccCode, INSERTED.TaxAccCode
                VALUES (@Name, @CurrencyCode, @SSAccCode, @TaxAccCode)`);

      // Add the new fields to the response if they were sent in the request
      const created = result.recordset[0];
      if (SSExpCode !== undefined) created.SSExpCode = SSExpCode;
      if (TaxExpCode !== undefined) created.TaxExpCode = TaxExpCode;
      if (SalExpCode !== undefined) created.SalExpCode = SalExpCode;
      
      res.status(201).json(created);
    }
  } catch (error) {
    console.error('Error creating entity:', error);
    res.status(500).json({ error: 'Failed to create entity' });
  }
});

// Update entity
router.put('/:id', async (req, res) => {
  try {
    const { Name, CurrencyCode, SSAccCode, TaxAccCode, SSExpCode, TaxExpCode, SalExpCode } = req.body;
    const pool = await getConnection();
    
    // Try to update with new fields first
    try {
      await pool
        .request()
        .input('id', req.params.id)
        .input('Name', sql.NVarChar(255), Name)
        .input('CurrencyCode', sql.NVarChar(10), CurrencyCode)
        .input('SSAccCode', sql.NVarChar(50), SSAccCode)
        .input('TaxAccCode', sql.NVarChar(50), TaxAccCode)
        .input('SSExpCode', sql.NVarChar(100), SSExpCode || null)
        .input('TaxExpCode', sql.NVarChar(100), TaxExpCode || null)
        .input('SalExpCode', sql.NVarChar(100), SalExpCode || null)
        .query(`UPDATE dbo.Entities
                SET Name = COALESCE(@Name, Name),
                    CurrencyCode = COALESCE(@CurrencyCode, CurrencyCode),
                    SSAccCode = COALESCE(@SSAccCode, SSAccCode),
                    TaxAccCode = COALESCE(@TaxAccCode, TaxAccCode),
                    SSExpCode = COALESCE(@SSExpCode, SSExpCode),
                    TaxExpCode = COALESCE(@TaxExpCode, TaxExpCode),
                    SalExpCode = COALESCE(@SalExpCode, SalExpCode)
                WHERE ID = @id`);

      // Try to get updated entity with new fields
      const updated = await pool.request().input('id', req.params.id).query('SELECT ID, Name, CurrencyCode, SSAccCode, TaxAccCode, SSExpCode, TaxExpCode, SalExpCode FROM dbo.Entities WHERE ID = @id');
      if (updated.recordset.length === 0) return res.status(404).json({ error: 'Entity not found' });
      res.json(updated.recordset[0]);
    } catch (updateError) {
      // If new fields don't exist, fall back to old behavior
      console.log('New fields not found in database, using fallback update');
      await pool
        .request()
        .input('id', req.params.id)
        .input('Name', sql.NVarChar(255), Name)
        .input('CurrencyCode', sql.NVarChar(10), CurrencyCode)
        .input('SSAccCode', sql.NVarChar(50), SSAccCode)
        .input('TaxAccCode', sql.NVarChar(50), TaxAccCode)
        .query(`UPDATE dbo.Entities
                SET Name = COALESCE(@Name, Name),
                    CurrencyCode = COALESCE(@CurrencyCode, CurrencyCode),
                    SSAccCode = COALESCE(@SSAccCode, SSAccCode),
                    TaxAccCode = COALESCE(@TaxAccCode, TaxAccCode)
                WHERE ID = @id`);

      const updated = await pool.request().input('id', req.params.id).query('SELECT ID, Name, CurrencyCode, SSAccCode, TaxAccCode FROM dbo.Entities WHERE ID = @id');
      if (updated.recordset.length === 0) return res.status(404).json({ error: 'Entity not found' });
      
      // Add the new fields to the response if they were sent in the request
      const result = updated.recordset[0];
      if (SSExpCode !== undefined) result.SSExpCode = SSExpCode;
      if (TaxExpCode !== undefined) result.TaxExpCode = TaxExpCode;
      if (SalExpCode !== undefined) result.SalExpCode = SalExpCode;
      
      res.json(result);
    }
  } catch (error) {
    console.error('Error updating entity:', error);
    res.status(500).json({ error: 'Failed to update entity' });
  }
});

// Delete entity
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    
    // Check if entity has resources
    const resCheck = await pool
      .request()
      .input('id', req.params.id)
      .query('SELECT COUNT(*) as count FROM dbo.Resources WHERE Entity = @id');
    
    if (resCheck.recordset[0].count > 0) {
      return res.status(400).json({ 
        error: 'Cannot delete entity with resources',
        details: `This entity has ${resCheck.recordset[0].count} resource(s). Delete or reassign resources first.`,
        resourcesCount: resCheck.recordset[0].count
      });
    }
    
    const deleted = await pool.request().input('id', req.params.id).query('DELETE FROM dbo.Entities OUTPUT DELETED.ID WHERE ID = @id');
    if (deleted.recordset.length === 0) return res.status(404).json({ error: 'Entity not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting entity:', error);
    res.status(500).json({ error: 'Failed to delete entity' });
  }
});

export default router;
