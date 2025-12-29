"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mssql_1 = __importDefault(require("mssql"));
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
// Get all versions for a project
router.get('/versions/:jobNo', async (req, res) => {
    const { jobNo } = req.params;
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        const result = await pool.request()
            .input('jobNo', mssql_1.default.NVarChar(20), jobNo)
            .query(`
        SELECT 
          Version_ID,
          Job_No,
          Version_Name,
          Version_Description,
          Is_Active,
          Is_Baseline,
          Created_By,
          Created_Date,
          Modified_By,
          Modified_Date,
          Source_Type
        FROM BudgetVersions
        WHERE Job_No = @jobNo AND Is_Active = 1
        ORDER BY Created_Date DESC
      `);
        res.json({
            success: true,
            versions: result.recordset,
            count: result.recordset.length
        });
    }
    catch (error) {
        console.error('Error fetching budget versions:', error);
        res.status(500).json({ error: error.message });
    }
});
// Create new version
router.post('/versions', async (req, res) => {
    const { jobNo, versionName, versionDescription, sourceType, sourceVersionId, createdBy } = req.body;
    if (!jobNo || !versionName || !createdBy) {
        return res.status(400).json({ error: 'jobNo, versionName, and createdBy are required' });
    }
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        const result = await pool.request()
            .input('jobNo', mssql_1.default.NVarChar(20), jobNo)
            .input('versionName', mssql_1.default.NVarChar(100), versionName)
            .input('versionDescription', mssql_1.default.NVarChar(500), versionDescription || null)
            .input('sourceType', mssql_1.default.NVarChar(20), sourceType || 'Manual Edit')
            .input('sourceVersionId', mssql_1.default.Int, sourceVersionId || null)
            .input('createdBy', mssql_1.default.NVarChar(100), createdBy)
            .query(`
        INSERT INTO BudgetVersions (Job_No, Version_Name, Version_Description, Source_Type, Source_Version_ID, Created_By)
        OUTPUT INSERTED.Version_ID, INSERTED.Version_Name, INSERTED.Created_Date
        VALUES (@jobNo, @versionName, @versionDescription, @sourceType, @sourceVersionId, @createdBy)
      `);
        res.json({
            success: true,
            version: result.recordset[0]
        });
    }
    catch (error) {
        console.error('Error creating budget version:', error);
        if (error.message.includes('UQ_BudgetVersion_Name')) {
            res.status(409).json({ error: 'A version with this name already exists for this project' });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
// Update version metadata
router.put('/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const { versionName, versionDescription, isBaseline, modifiedBy } = req.body;
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        // If setting as baseline, unset other baselines for the same project
        if (isBaseline) {
            const jobNoResult = await pool.request()
                .input('versionId', mssql_1.default.Int, versionId)
                .query('SELECT Job_No FROM BudgetVersions WHERE Version_ID = @versionId');
            if (jobNoResult.recordset.length > 0) {
                await pool.request()
                    .input('jobNo', mssql_1.default.NVarChar(20), jobNoResult.recordset[0].Job_No)
                    .query('UPDATE BudgetVersions SET Is_Baseline = 0 WHERE Job_No = @jobNo');
            }
        }
        await pool.request()
            .input('versionId', mssql_1.default.Int, versionId)
            .input('versionName', mssql_1.default.NVarChar(100), versionName)
            .input('versionDescription', mssql_1.default.NVarChar(500), versionDescription || null)
            .input('isBaseline', mssql_1.default.Bit, isBaseline || 0)
            .input('modifiedBy', mssql_1.default.NVarChar(100), modifiedBy)
            .query(`
        UPDATE BudgetVersions
        SET Version_Name = @versionName,
            Version_Description = @versionDescription,
            Is_Baseline = @isBaseline,
            Modified_By = @modifiedBy,
            Modified_Date = GETDATE()
        WHERE Version_ID = @versionId
      `);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating budget version:', error);
        res.status(500).json({ error: error.message });
    }
});
// Delete version (soft delete)
router.delete('/versions/:versionId', async (req, res) => {
    const { versionId } = req.params;
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        await pool.request()
            .input('versionId', mssql_1.default.Int, versionId)
            .query('UPDATE BudgetVersions SET Is_Active = 0 WHERE Version_ID = @versionId');
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error deleting budget version:', error);
        res.status(500).json({ error: error.message });
    }
});
// Get budget data for a version
router.get('/data/:versionId', async (req, res) => {
    const { versionId } = req.params;
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        const result = await pool.request()
            .input('versionId', mssql_1.default.Int, versionId)
            .query(`
        SELECT 
          ID,
          Version_ID,
          Job_No,
          Job_Task_No,
          Budget_Month,
          Budget_Amount,
          Last_Modified_By,
          Last_Modified_Date
        FROM BudgetData
        WHERE Version_ID = @versionId
        ORDER BY Job_Task_No, Budget_Month
      `);
        res.json({
            success: true,
            budgetData: result.recordset,
            count: result.recordset.length
        });
    }
    catch (error) {
        console.error('Error fetching budget data:', error);
        res.status(500).json({ error: error.message });
    }
});
// Save budget data (bulk insert/update)
router.post('/data/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const { budgetData, modifiedBy } = req.body;
    if (!Array.isArray(budgetData) || budgetData.length === 0) {
        return res.status(400).json({ error: 'budgetData array is required and cannot be empty' });
    }
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        const transaction = pool.transaction();
        await transaction.begin();
        try {
            // Delete existing data for this version
            await transaction.request()
                .input('versionId', mssql_1.default.Int, versionId)
                .query('DELETE FROM BudgetData WHERE Version_ID = @versionId');
            // Insert new data
            for (const item of budgetData) {
                await transaction.request()
                    .input('versionId', mssql_1.default.Int, versionId)
                    .input('jobNo', mssql_1.default.NVarChar(20), item.jobNo)
                    .input('jobTaskNo', mssql_1.default.NVarChar(20), item.jobTaskNo)
                    .input('budgetMonth', mssql_1.default.Date, item.budgetMonth)
                    .input('budgetAmount', mssql_1.default.Decimal(18, 2), item.budgetAmount)
                    .input('modifiedBy', mssql_1.default.NVarChar(100), modifiedBy || 'System')
                    .query(`
            INSERT INTO BudgetData (Version_ID, Job_No, Job_Task_No, Budget_Month, Budget_Amount, Last_Modified_By, Last_Modified_Date)
            VALUES (@versionId, @jobNo, @jobTaskNo, @budgetMonth, @budgetAmount, @modifiedBy, GETDATE())
          `);
            }
            // Update version modified date
            await transaction.request()
                .input('versionId', mssql_1.default.Int, versionId)
                .input('modifiedBy', mssql_1.default.NVarChar(100), modifiedBy || 'System')
                .query(`
          UPDATE BudgetVersions
          SET Modified_By = @modifiedBy, Modified_Date = GETDATE()
          WHERE Version_ID = @versionId
        `);
            await transaction.commit();
            res.json({
                success: true,
                recordsInserted: budgetData.length
            });
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error('Error saving budget data:', error);
        res.status(500).json({ error: error.message });
    }
});
// Update specific budget cells
router.put('/data/:versionId', async (req, res) => {
    const { versionId } = req.params;
    const { updates, modifiedBy } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
        return res.status(400).json({ error: 'updates array is required and cannot be empty' });
    }
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        const transaction = pool.transaction();
        await transaction.begin();
        try {
            for (const update of updates) {
                // Update or insert budget data
                await transaction.request()
                    .input('versionId', mssql_1.default.Int, versionId)
                    .input('jobNo', mssql_1.default.NVarChar(20), update.jobNo)
                    .input('jobTaskNo', mssql_1.default.NVarChar(20), update.jobTaskNo)
                    .input('budgetMonth', mssql_1.default.Date, update.budgetMonth)
                    .input('budgetAmount', mssql_1.default.Decimal(18, 2), update.budgetAmount)
                    .input('modifiedBy', mssql_1.default.NVarChar(100), modifiedBy || 'System')
                    .query(`
            MERGE BudgetData AS target
            USING (SELECT @versionId AS Version_ID, @jobNo AS Job_No, @jobTaskNo AS Job_Task_No, @budgetMonth AS Budget_Month) AS source
            ON target.Version_ID = source.Version_ID 
              AND target.Job_No = source.Job_No 
              AND target.Job_Task_No = source.Job_Task_No 
              AND target.Budget_Month = source.Budget_Month
            WHEN MATCHED THEN
              UPDATE SET Budget_Amount = @budgetAmount, Last_Modified_By = @modifiedBy, Last_Modified_Date = GETDATE()
            WHEN NOT MATCHED THEN
              INSERT (Version_ID, Job_No, Job_Task_No, Budget_Month, Budget_Amount, Last_Modified_By, Last_Modified_Date)
              VALUES (@versionId, @jobNo, @jobTaskNo, @budgetMonth, @budgetAmount, @modifiedBy, GETDATE());
          `);
            }
            await transaction.commit();
            res.json({
                success: true,
                recordsUpdated: updates.length
            });
        }
        catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
    catch (error) {
        console.error('Error updating budget data:', error);
        res.status(500).json({ error: error.message });
    }
});
// Copy budget data from one version to another
router.post('/data/:versionId/copy', async (req, res) => {
    const { versionId } = req.params;
    const { sourceVersionId } = req.body;
    if (!sourceVersionId) {
        return res.status(400).json({ error: 'sourceVersionId is required' });
    }
    try {
        const pool = await mssql_1.default.connect((0, database_1.getDbConfig)());
        const result = await pool.request()
            .input('versionId', mssql_1.default.Int, versionId)
            .input('sourceVersionId', mssql_1.default.Int, sourceVersionId)
            .query(`
        INSERT INTO BudgetData (Version_ID, Job_No, Job_Task_No, Budget_Month, Budget_Amount, Last_Modified_By, Last_Modified_Date)
        SELECT @versionId, Job_No, Job_Task_No, Budget_Month, Budget_Amount, Last_Modified_By, GETDATE()
        FROM BudgetData
        WHERE Version_ID = @sourceVersionId
      `);
        res.json({
            success: true,
            recordsCopied: result.rowsAffected[0]
        });
    }
    catch (error) {
        console.error('Error copying budget data:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
