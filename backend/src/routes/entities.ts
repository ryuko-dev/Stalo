import { Router } from 'express';
import { getConnection, sql } from '../config/database';

const router = Router();

// Get all entities
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT ID, Name, CurrencyCode, SSAccCode, TaxAccCode FROM dbo.Entities ORDER BY Name');
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
    const result = await pool.request().input('id', req.params.id).query('SELECT ID, Name, CurrencyCode, SSAccCode, TaxAccCode FROM dbo.Entities WHERE ID = @id');
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
    const { Name, CurrencyCode, SSAccCode, TaxAccCode } = req.body;
    const pool = await getConnection();
    const result = await pool
      .request()
      .input('Name', sql.NVarChar(255), Name)
      .input('CurrencyCode', sql.NVarChar(10), CurrencyCode)
      .input('SSAccCode', sql.NVarChar(50), SSAccCode)
      .input('TaxAccCode', sql.NVarChar(50), TaxAccCode)
      .query(`INSERT INTO dbo.Entities (Name, CurrencyCode, SSAccCode, TaxAccCode)
              OUTPUT INSERTED.ID, INSERTED.Name, INSERTED.CurrencyCode, INSERTED.SSAccCode, INSERTED.TaxAccCode
              VALUES (@Name, @CurrencyCode, @SSAccCode, @TaxAccCode)`);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating entity:', error);
    res.status(500).json({ error: 'Failed to create entity' });
  }
});

// Update entity
router.put('/:id', async (req, res) => {
  try {
    const { Name, CurrencyCode, SSAccCode, TaxAccCode } = req.body;
    const pool = await getConnection();
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
    res.json(updated.recordset[0]);
  } catch (error) {
    console.error('Error updating entity:', error);
    res.status(500).json({ error: 'Failed to update entity' });
  }
});

// Delete entity
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const deleted = await pool.request().input('id', req.params.id).query('DELETE FROM dbo.Entities OUTPUT DELETED.ID WHERE ID = @id');
    if (deleted.recordset.length === 0) return res.status(404).json({ error: 'Entity not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting entity:', error);
    res.status(500).json({ error: 'Failed to delete entity' });
  }
});

export default router;
