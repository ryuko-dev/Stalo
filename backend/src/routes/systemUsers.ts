import { Router } from 'express';
import { getConnection, sql } from '../config/database';
import { clearRoleCache } from '../middleware/rbac';

const router = Router();

// Super admin email - cannot be modified or deleted
const SUPER_ADMIN_EMAIL = 'sinan.mecit@arkgroupdmcc.com';

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

    // Get current user data for audit log
    const currentUser = await pool.request()
      .input('id', req.params.id)
      .query('SELECT ID, Name, EmailAddress, Role FROM dbo.SystemUsers WHERE ID = @id');
    
    if (currentUser.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = currentUser.recordset[0].Role;
    const userName = currentUser.recordset[0].Name;
    const userEmail = currentUser.recordset[0].EmailAddress;

    // Protect super admin from role/email changes
    if (userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      if (Role && Role !== 'Admin') {
        return res.status(403).json({ error: 'Cannot change super admin role' });
      }
      if (EmailAddress && EmailAddress.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
        return res.status(403).json({ error: 'Cannot change super admin email' });
      }
    }

    // Update the user
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

    // Log role change if role was updated
    if (Role && Role !== oldRole) {
      try {
        await pool
          .request()
          .input('UserID', sql.NVarChar(50), req.params.id)
          .input('UserName', sql.NVarChar(255), userName)
          .input('UserEmail', sql.NVarChar(255), userEmail)
          .input('OldRole', sql.NVarChar(100), oldRole || '')
          .input('NewRole', sql.NVarChar(100), Role)
          .input('ChangedBy', sql.NVarChar(255), req.headers['x-user-email'] || 'System')
          .query(`INSERT INTO dbo.RoleAuditLog (UserID, UserName, UserEmail, OldRole, NewRole, ChangedBy)
                  VALUES (@UserID, @UserName, @UserEmail, @OldRole, @NewRole, @ChangedBy)`);
        console.log(`✅ Audit log: Role changed for ${userEmail} from '${oldRole}' to '${Role}'`);
      } catch (auditError) {
        console.error('⚠️ Failed to log audit entry:', auditError);
        // Don't fail the request if audit logging fails
      }
      
      // Clear role cache to ensure role changes take effect immediately
      clearRoleCache(userEmail);
    }

    const updated = await pool.request().input('id', req.params.id).query('SELECT ID, Name, EmailAddress, StartDate, EndDate, Active, Role FROM dbo.SystemUsers WHERE ID = @id');
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
    
    // Check if user being deleted is super admin
    const userCheck = await pool.request()
      .input('id', req.params.id)
      .query('SELECT EmailAddress FROM dbo.SystemUsers WHERE ID = @id');
    
    if (userCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (userCheck.recordset[0].EmailAddress.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(403).json({ error: 'Cannot delete super admin account' });
    }
    
    const deleted = await pool.request().input('id', req.params.id).query('DELETE FROM dbo.SystemUsers OUTPUT DELETED.ID WHERE ID = @id');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting system user:', error);
    res.status(500).json({ error: 'Failed to delete system user' });
  }
});

// Get audit logs for role changes
router.get('/audit/role-changes', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .query(`SELECT ID, UserID, UserName, UserEmail, OldRole, NewRole, ChangedBy, ChangedAt 
              FROM dbo.RoleAuditLog 
              ORDER BY ChangedAt DESC`);
    res.json(result.recordset);
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs', details: error.message });
  }
});

export default router;
