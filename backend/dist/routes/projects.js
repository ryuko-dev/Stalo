"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
// Get all projects
router.get('/', async (req, res) => {
    try {
        const pool = await (0, database_1.getConnection)();
        const result = await pool.request().query('SELECT * FROM dbo.Projects');
        res.json(result.recordset);
    }
    catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});
// Get project by ID
router.get('/:id', async (req, res) => {
    try {
        const pool = await (0, database_1.getConnection)();
        const result = await pool
            .request()
            .input('id', req.params.id)
            .query('SELECT * FROM dbo.Projects WHERE ID = @id');
        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(result.recordset[0]);
    }
    catch (error) {
        console.error('Error fetching project:', error);
        res.status(500).json({ error: 'Failed to fetch project' });
    }
});
// Create project
router.post('/', async (req, res) => {
    try {
        const { Name, StartDate, EndDate, ProjectCurrency, ProjectBudget, BudgetManager, AllocationMode, Fringe } = req.body;
        const pool = await (0, database_1.getConnection)();
        const result = await pool
            .request()
            .input('Name', database_1.sql.NVarChar(255), Name)
            .input('StartDate', database_1.sql.Date, StartDate || null)
            .input('EndDate', database_1.sql.Date, EndDate || null)
            .input('ProjectCurrency', database_1.sql.NVarChar(10), ProjectCurrency)
            .input('ProjectBudget', database_1.sql.Decimal(18, 2), ProjectBudget ?? 0)
            .input('BudgetManager', database_1.sql.UniqueIdentifier, BudgetManager || null)
            .input('AllocationMode', database_1.sql.NVarChar(50), AllocationMode)
            .input('Fringe', database_1.sql.NVarChar(10), typeof Fringe === 'boolean' ? (Fringe ? 'Yes' : 'No') : Fringe)
            .query(`INSERT INTO dbo.Projects (Name, StartDate, EndDate, ProjectCurrency, ProjectBudget, BudgetManager, AllocationMode, Fringe)
              OUTPUT INSERTED.*
              VALUES (@Name, @StartDate, @EndDate, @ProjectCurrency, @ProjectBudget, @BudgetManager, @AllocationMode, @Fringe)`);
        res.status(201).json(result.recordset[0]);
    }
    catch (error) {
        console.error('Error creating project:', error);
        res.status(500).json({ error: 'Failed to create project' });
    }
});
// Update project
router.put('/:id', async (req, res) => {
    try {
        const { Name, StartDate, EndDate, ProjectCurrency, ProjectBudget, BudgetManager, AllocationMode, Fringe } = req.body;
        const pool = await (0, database_1.getConnection)();
        await pool
            .request()
            .input('id', req.params.id)
            .input('Name', database_1.sql.NVarChar(255), Name)
            .input('StartDate', database_1.sql.Date, StartDate || null)
            .input('EndDate', database_1.sql.Date, EndDate || null)
            .input('ProjectCurrency', database_1.sql.NVarChar(10), ProjectCurrency)
            .input('ProjectBudget', database_1.sql.Decimal(18, 2), ProjectBudget ?? 0)
            .input('BudgetManager', database_1.sql.UniqueIdentifier, BudgetManager || null)
            .input('AllocationMode', database_1.sql.NVarChar(50), AllocationMode)
            .input('Fringe', database_1.sql.NVarChar(10), typeof Fringe === 'boolean' ? (Fringe ? 'Yes' : 'No') : Fringe)
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
    }
    catch (error) {
        console.error('Error updating project:', error);
        res.status(500).json({ error: 'Failed to update project' });
    }
});
// Delete project
router.delete('/:id', async (req, res) => {
    try {
        const pool = await (0, database_1.getConnection)();
        // Check if project has positions
        const posCheck = await pool
            .request()
            .input('id', req.params.id)
            .query('SELECT COUNT(*) as count FROM dbo.Positions WHERE Project = @id');
        if (posCheck.recordset[0].count > 0) {
            return res.status(400).json({
                error: 'Cannot delete project with positions',
                details: `This project has ${posCheck.recordset[0].count} position(s). Delete positions first.`,
                positionsCount: posCheck.recordset[0].count
            });
        }
        const deleted = await pool
            .request()
            .input('id', req.params.id)
            .query('DELETE FROM dbo.Projects OUTPUT DELETED.ID WHERE ID = @id');
        if (deleted.recordset.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ success: true, message: 'Project deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting project:', error);
        res.status(500).json({ error: 'Failed to delete project', details: error.message });
    }
});
// Get project with positions
router.get('/:id/positions', async (req, res) => {
    try {
        const pool = await (0, database_1.getConnection)();
        const result = await pool
            .request()
            .input('projectId', req.params.id)
            .query('SELECT * FROM dbo.Positions WHERE mvarchar2525 = @projectId');
        res.json(result.recordset);
    }
    catch (error) {
        console.error('Error fetching project positions:', error);
        res.status(500).json({ error: 'Failed to fetch project positions' });
    }
});
exports.default = router;
