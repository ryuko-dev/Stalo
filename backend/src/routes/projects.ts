import { Router } from 'express';
import { getConnection, sql } from '../config/database';
import { Project } from '../models/types';

const router = Router();

// Get all projects
router.get('/', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool.request().query('SELECT * FROM dbo.Projects');
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project by ID
router.get('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input('id', req.params.id)
      .query('SELECT * FROM dbo.Projects WHERE ID = @id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(result.recordset[0]);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Create project
router.post('/', async (req, res) => {
  try {
    const { Name, StartDate, EndDate, ProjectCurrency, ProjectBudget, BudgetManager, AllocationMode, Fringe } = req.body as Partial<Project> & {
      ProjectCurrency?: string;
      ProjectBudget?: number;
      BudgetManager?: string;
      Fringe?: string | boolean;
    };

    const pool = await getConnection();
    const result = await pool
      .request()
      .input('Name', sql.NVarChar(255), Name)
      .input('StartDate', sql.Date, StartDate || null)
      .input('EndDate', sql.Date, EndDate || null)
      .input('ProjectCurrency', sql.NVarChar(10), ProjectCurrency)
      .input('ProjectBudget', sql.Decimal(18, 2), ProjectBudget ?? 0)
      .input('BudgetManager', sql.UniqueIdentifier, BudgetManager || null)
      .input('AllocationMode', sql.NVarChar(50), AllocationMode)
      .input('Fringe', sql.NVarChar(10), typeof Fringe === 'boolean' ? (Fringe ? 'Yes' : 'No') : Fringe)
      .query(`INSERT INTO dbo.Projects (Name, StartDate, EndDate, ProjectCurrency, ProjectBudget, BudgetManager, AllocationMode, Fringe)
              OUTPUT INSERTED.*
              VALUES (@Name, @StartDate, @EndDate, @ProjectCurrency, @ProjectBudget, @BudgetManager, @AllocationMode, @Fringe)`);

    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project
router.put('/:id', async (req, res) => {
  try {
    const { Name, StartDate, EndDate, ProjectCurrency, ProjectBudget, BudgetManager, AllocationMode, Fringe } = req.body as Partial<Project> & {
      ProjectCurrency?: string;
      ProjectBudget?: number;
      BudgetManager?: string;
      Fringe?: string | boolean;
    };

    const pool = await getConnection();
    await pool
      .request()
      .input('id', req.params.id)
      .input('Name', sql.NVarChar(255), Name)
      .input('StartDate', sql.Date, StartDate || null)
      .input('EndDate', sql.Date, EndDate || null)
      .input('ProjectCurrency', sql.NVarChar(10), ProjectCurrency)
      .input('ProjectBudget', sql.Decimal(18, 2), ProjectBudget ?? 0)
      .input('BudgetManager', sql.UniqueIdentifier, BudgetManager || null)
      .input('AllocationMode', sql.NVarChar(50), AllocationMode)
      .input('Fringe', sql.NVarChar(10), typeof Fringe === 'boolean' ? (Fringe ? 'Yes' : 'No') : Fringe)
      .query(`UPDATE dbo.Projects
              SET Name = COALESCE(@Name, Name),
                  StartDate = COALESCE(@StartDate, StartDate),
                  EndDate = COALESCE(@EndDate, EndDate),
                  ProjectCurrency = COALESCE(@ProjectCurrency, ProjectCurrency),
                  ProjectBudget = COALESCE(@ProjectBudget, ProjectBudget),
                  BudgetManager = COALESCE(@BudgetManager, BudgetManager),
                  AllocationMode = COALESCE(@AllocationMode, AllocationMode),
                  Fringe = COALESCE(@Fringe, Fringe)
              WHERE ID = @id`);

    const updated = await pool
      .request()
      .input('id', req.params.id)
      .query('SELECT * FROM dbo.Projects WHERE ID = @id');

    if (updated.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updated.recordset[0]);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getConnection();
    const deleted = await pool
      .request()
      .input('id', req.params.id)
      .query('DELETE FROM dbo.Projects OUTPUT DELETED.ID WHERE ID = @id');

    if (deleted.recordset.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Get project with positions
router.get('/:id/positions', async (req, res) => {
  try {
    const pool = await getConnection();
    const result = await pool
      .request()
      .input('projectId', req.params.id)
      .query('SELECT * FROM dbo.Positions WHERE mvarchar2525 = @projectId');
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching project positions:', error);
    res.status(500).json({ error: 'Failed to fetch project positions' });
  }
});

export default router;
