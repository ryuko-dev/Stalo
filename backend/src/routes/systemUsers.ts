import { Router } from 'express';
import { getConnection, sql } from '../config/database';

const router = Router();

// Get all system users
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT ID, Name, EmailAddress, StartDate, EndDate, Active, Role FROM dbo.SystemUsers');
    res.json(result.recordset);
  } catch (error: any) {
    console.error('Error fetching system users:', error);
    console.error('Error details:', error.message, error.number, error.code);
    res.status(500).json({ error: 'Failed to fetch system users', details: error.message });
  }
});

// Get user by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().input('id', req.params.id).query('SELECT ID, Name, EmailAddress, StartDate, EndDate, Active, Role FROM dbo.SystemUsers WHERE ID = @id');
    if (result.recordset.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching system user:', error);
    res.status(500).json({ error: 'Failed to fetch system user' });
  }
});

// Create new user
router.post('/', async (req, res) => {
  try {
    const { Name, EmailAddress, StartDate, EndDate, Active, Role } = req.body;
    const pool = await getConnection();

    const result = await pool
      .request()
      .input('Name', sql.NVarChar(255), Name)
      .input('EmailAddress', sql.NVarChar(255), EmailAddress)
      .input('StartDate', sql.Date, StartDate || null)
      .input('EndDate', sql.Date, EndDate || null)
      .input('Active', sql.Bit, Active === true || Active === 'true' || Active === 1 ? 1 : 0)
      .input('Role', sql.NVarChar(100), Role)
      .query(`INSERT INTO dbo.SystemUsers (Name, EmailAddress, StartDate, EndDate, Active, Role)
              OUTPUT INSERTED.ID, INSERTED.Name, INSERTED.EmailAddress, INSERTED.StartDate, INSERTED.EndDate, INSERTED.Active, INSERTED.Role
              VALUES (@Name, @EmailAddress, @StartDate, @EndDate, @Active, @Role)`);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating system user:', error);
    res.status(500).json({ error: 'Failed to create system user' });
  }
});

// Update user (Active and Role and optional dates/email/name)
router.put('/:id', async (req, res) => {
  try {
    const { Name, EmailAddress, StartDate, EndDate, Active, Role } = req.body;
    const pool = await getConnection();

    await pool
      .request()
      .input('id', req.params.id)
      .input('Name', sql.NVarChar(255), Name)
      .input('EmailAddress', sql.NVarChar(255), EmailAddress)
      .input('StartDate', sql.Date, StartDate || null)
      .input('EndDate', sql.Date, EndDate || null)
      .input('Active', sql.Bit, Active === true || Active === 'true' || Active === 1 ? 1 : 0)
      .input('Role', sql.NVarChar(100), Role)
      .query(`UPDATE dbo.SystemUsers
          SET Name = COALESCE(@Name, Name),
            EmailAddress = COALESCE(@EmailAddress, EmailAddress),
            StartDate = COALESCE(@StartDate, StartDate),
            EndDate = COALESCE(@EndDate, EndDate),
            Active = @Active,
            Role = COALESCE(@Role, Role)
          WHERE ID = @id`);

    const updated = await pool.request().input('id', req.params.id).query('SELECT ID, Name, EmailAddress, StartDate, EndDate, Active, Role FROM dbo.SystemUsers WHERE ID = @id');
    if (updated.recordset.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(updated.recordset[0]);
  } catch (error) {
    console.error('Error updating system user:', error);
    res.status(500).json({ error: 'Failed to update system user' });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const deleted = await pool.request().input('id', req.params.id).query('DELETE FROM dbo.SystemUsers OUTPUT DELETED.ID WHERE ID = @id');
    if (deleted.recordset.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting system user:', error);
    res.status(500).json({ error: 'Failed to delete system user' });
  }
});

export default router;
