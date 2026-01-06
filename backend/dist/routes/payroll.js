"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const router = (0, express_1.Router)();
// Get projects that fall within the selected month
router.get('/projects', async (req, res) => {
    try {
        const { month } = req.query; // Format: YYYY-MM-DD (first day of month)
        if (!month) {
            return res.status(400).json({ error: 'Month parameter is required (format: YYYY-MM-dd)' });
        }
        const pool = await (0, database_1.getConnection)();
        // Get projects where the selected month falls between StartDate and EndDate
        const result = await pool
            .request()
            .input('month', database_1.sql.Date, month)
            .query(`
        SELECT 
          ID,
          Name,
          StartDate,
          EndDate,
          Fringe
        FROM dbo.Projects
        WHERE @month BETWEEN DATEFROMPARTS(YEAR(StartDate), MONTH(StartDate), 1) 
                     AND DATEFROMPARTS(YEAR(EndDate), MONTH(EndDate), 1)
        ORDER BY Name
      `);
        res.json(result.recordset);
    }
    catch (error) {
        console.error('Error fetching projects for month:', error);
        res.status(500).json({ error: 'Failed to fetch projects', details: error.message });
    }
});
// Get payroll data for a specific month
// This returns unique resources from allocations for the selected month
// grouped by entity, with auto-calculated work days and currency
router.get('/', async (req, res) => {
    try {
        const { month } = req.query; // Format: YYYY-MM-DD (first day of month)
        if (!month) {
            return res.status(400).json({ error: 'Month parameter is required (format: YYYY-MM-DD)' });
        }
        const pool = await (0, database_1.getConnection)();
        // Get unique resources that have allocations for the selected month
        // Join with Resources to get WorkDays and Entity
        // Join with Entities to get Currency
        const result = await pool
            .request()
            .input('month', database_1.sql.Date, month)
            .query(`
        SELECT DISTINCT
          r.ID as ResourceID,
          r.Name as ResourceName,
          r.ResourceType,
          r.WorkDays,
          r.Department,
          r.DynamicsVendorAcc,
          e.ID as EntityID,
          e.Name as EntityName,
          e.CurrencyCode as Currency,
          e.SSAccCode,
          e.TaxAccCode
        FROM dbo.Allocation a
        INNER JOIN dbo.Resources r ON a.ResourceID = r.ID
        LEFT JOIN dbo.Entities e ON r.Entity = e.ID
        WHERE YEAR(a.MonthYear) = YEAR(@month) 
          AND MONTH(a.MonthYear) = MONTH(@month)
          AND r.ResourceType != 'SME'
        ORDER BY e.Name, r.Name
      `);
        res.json(result.recordset);
    }
    catch (error) {
        console.error('Error fetching payroll data:', error);
        res.status(500).json({ error: 'Failed to fetch payroll data', details: error.message });
    }
});
// Get all payroll records for a month
router.get('/all', async (req, res) => {
    try {
        const { month } = req.query;
        if (!month) {
            return res.status(400).json({ error: 'Month parameter is required' });
        }
        const pool = await (0, database_1.getConnection)();
        const result = await pool
            .request()
            .input('month', database_1.sql.Date, month)
            .query(`
        SELECT p.*, r.Name as ResourceName, e.Name as EntityName
        FROM dbo.PayrollAllocation p
        LEFT JOIN dbo.Resources r ON p.ResourceID = r.ID
        LEFT JOIN dbo.Entities e ON p.EntityID = e.ID
        WHERE YEAR(p.Month) = YEAR(@month) 
          AND MONTH(p.Month) = MONTH(@month)
        ORDER BY e.Name, r.Name
      `);
        res.json(result.recordset);
    }
    catch (error) {
        console.error('Error fetching payroll records:', error);
        res.status(500).json({ error: 'Failed to fetch payroll records', details: error.message });
    }
});
// Create or update payroll record
router.post('/', async (req, res) => {
    try {
        const { ResourceID, Department, EntityID, WorkingDays, Currency, NetSalary, SocialSecurity, EmployeeTax, EmployerTax, Housing, CommunicationsOther, Month, AnnualLeave, SickLeave, PublicHolidays, ProjectAllocations, Locked } = req.body;
        if (!ResourceID || !Month) {
            return res.status(400).json({ error: 'ResourceID and Month are required' });
        }
        // Helper function to validate GUID format
        const isValidGuid = (str) => {
            if (!str)
                return false;
            const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            return guidRegex.test(str);
        };
        // Sanitize EntityID - only pass valid GUID or null
        const sanitizedEntityID = isValidGuid(EntityID) ? EntityID : null;
        const pool = await (0, database_1.getConnection)();
        // Check if record already exists for this resource and month
        const existingRecord = await pool
            .request()
            .input('resourceId', database_1.sql.UniqueIdentifier, ResourceID)
            .input('month', database_1.sql.Date, Month)
            .query(`
        SELECT ID FROM dbo.PayrollAllocation
        WHERE ResourceID = @resourceId 
          AND YEAR(Month) = YEAR(@month) 
          AND MONTH(Month) = MONTH(@month)
      `);
        if (existingRecord.recordset.length > 0) {
            // Update existing record
            const updateResult = await pool
                .request()
                .input('id', database_1.sql.UniqueIdentifier, existingRecord.recordset[0].ID)
                .input('Department', database_1.sql.NVarChar(200), Department || null)
                .input('EntityID', database_1.sql.UniqueIdentifier, sanitizedEntityID)
                .input('WorkingDays', database_1.sql.NVarChar(20), WorkingDays || null)
                .input('Currency', database_1.sql.NVarChar(10), Currency || null)
                .input('NetSalary', database_1.sql.Decimal(18, 2), NetSalary || null)
                .input('SocialSecurity', database_1.sql.Decimal(18, 2), SocialSecurity || null)
                .input('EmployeeTax', database_1.sql.Decimal(18, 2), EmployeeTax || null)
                .input('EmployerTax', database_1.sql.Decimal(18, 2), EmployerTax || null)
                .input('Housing', database_1.sql.Decimal(18, 2), Housing || null)
                .input('CommunicationsOther', database_1.sql.Decimal(18, 2), CommunicationsOther || null)
                .input('AnnualLeave', database_1.sql.Int, AnnualLeave || null)
                .input('SickLeave', database_1.sql.Int, SickLeave || null)
                .input('PublicHolidays', database_1.sql.Int, PublicHolidays || null)
                .input('ProjectAllocations', database_1.sql.NVarChar(database_1.sql.MAX), ProjectAllocations || null)
                .input('Locked', database_1.sql.Bit, Locked || false)
                .query(`
          UPDATE dbo.PayrollAllocation
          SET Department = @Department,
              EntityID = @EntityID,
              WorkingDays = @WorkingDays,
              Currency = @Currency,
              NetSalary = @NetSalary,
              SocialSecurity = @SocialSecurity,
              EmployeeTax = @EmployeeTax,
              EmployerTax = @EmployerTax,
              Housing = @Housing,
              CommunicationsOther = @CommunicationsOther,
              AnnualLeave = @AnnualLeave,
              SickLeave = @SickLeave,
              PublicHolidays = @PublicHolidays,
              ProjectAllocations = @ProjectAllocations,
              Locked = @Locked
          WHERE ID = @id;
          
          SELECT * FROM dbo.PayrollAllocation WHERE ID = @id;
        `);
            return res.json(updateResult.recordset[0]);
        }
        // Create new record
        const insertResult = await pool
            .request()
            .input('ResourceID', database_1.sql.UniqueIdentifier, ResourceID)
            .input('Department', database_1.sql.NVarChar(200), Department || null)
            .input('EntityID', database_1.sql.UniqueIdentifier, sanitizedEntityID)
            .input('WorkingDays', database_1.sql.NVarChar(20), WorkingDays || null)
            .input('Currency', database_1.sql.NVarChar(10), Currency || null)
            .input('NetSalary', database_1.sql.Decimal(18, 2), NetSalary || null)
            .input('SocialSecurity', database_1.sql.Decimal(18, 2), SocialSecurity || null)
            .input('EmployeeTax', database_1.sql.Decimal(18, 2), EmployeeTax || null)
            .input('EmployerTax', database_1.sql.Decimal(18, 2), EmployerTax || null)
            .input('Housing', database_1.sql.Decimal(18, 2), Housing || null)
            .input('CommunicationsOther', database_1.sql.Decimal(18, 2), CommunicationsOther || null)
            .input('Month', database_1.sql.Date, Month)
            .input('AnnualLeave', database_1.sql.Int, AnnualLeave || null)
            .input('SickLeave', database_1.sql.Int, SickLeave || null)
            .input('PublicHolidays', database_1.sql.Int, PublicHolidays || null)
            .input('ProjectAllocations', database_1.sql.NVarChar(database_1.sql.MAX), ProjectAllocations || null)
            .input('Locked', database_1.sql.Bit, Locked || false)
            .query(`
        INSERT INTO dbo.PayrollAllocation (
          ResourceID, Department, EntityID, WorkingDays, Currency,
          NetSalary, SocialSecurity, EmployeeTax, EmployerTax, Housing,
          CommunicationsOther, Month, AnnualLeave, SickLeave, PublicHolidays,
          ProjectAllocations, Locked
        )
        VALUES (
          @ResourceID, @Department, @EntityID, @WorkingDays, @Currency,
          @NetSalary, @SocialSecurity, @EmployeeTax, @EmployerTax, @Housing,
          @CommunicationsOther, @Month, @AnnualLeave, @SickLeave, @PublicHolidays,
          @ProjectAllocations, @Locked
        );
        
        SELECT SCOPE_IDENTITY() as ID;
      `);
        // Get the inserted record
        const insertedRecord = await pool
            .request()
            .input('resourceId', database_1.sql.UniqueIdentifier, ResourceID)
            .input('month', database_1.sql.Date, Month)
            .query(`
        SELECT * FROM dbo.PayrollAllocation 
        WHERE ResourceID = @resourceId AND Month = @month
      `);
        res.status(201).json(insertedRecord.recordset[0]);
    }
    catch (error) {
        console.error('Error creating/updating payroll record:', error);
        console.error('Request body:', req.body);
        res.status(500).json({ error: 'Failed to save payroll record', details: error.message });
    }
});
// Lock or unlock payroll records
router.patch('/lock', async (req, res) => {
    try {
        const { recordIds, locked } = req.body;
        if (!Array.isArray(recordIds) || recordIds.length === 0) {
            return res.status(400).json({ error: 'recordIds array is required' });
        }
        if (typeof locked !== 'boolean') {
            return res.status(400).json({ error: 'locked boolean value is required' });
        }
        const pool = await (0, database_1.getConnection)();
        // Create request with parameters
        const request = pool.request().input('locked', database_1.sql.Bit, locked);
        // Add each record ID as a parameter
        recordIds.forEach((id, index) => {
            request.input(`id${index}`, database_1.sql.UniqueIdentifier, id);
        });
        // Update multiple records
        const result = await request.query(`
      UPDATE dbo.PayrollAllocation
      SET Locked = @locked
      WHERE ID IN (${recordIds.map((_, index) => `@id${index}`).join(', ')});
      
      SELECT ${recordIds.length} as UpdatedCount;
    `);
        res.json({
            success: true,
            updatedCount: recordIds.length,
            locked: locked
        });
    }
    catch (error) {
        console.error('Error updating lock status:', error);
        res.status(500).json({ error: 'Failed to update lock status', details: error.message });
    }
});
// Lock or unlock all payroll records for a month
router.patch('/lock-month', async (req, res) => {
    try {
        const { month, locked } = req.body;
        if (!month) {
            return res.status(400).json({ error: 'month parameter is required' });
        }
        if (typeof locked !== 'boolean') {
            return res.status(400).json({ error: 'locked boolean value is required' });
        }
        const pool = await (0, database_1.getConnection)();
        const result = await pool
            .request()
            .input('month', database_1.sql.Date, month)
            .input('locked', database_1.sql.Bit, locked)
            .query(`
        UPDATE dbo.PayrollAllocation
        SET Locked = @locked
        WHERE YEAR(Month) = YEAR(@month) 
          AND MONTH(Month) = MONTH(@month);
          
        SELECT @@ROWCOUNT as UpdatedCount;
      `);
        res.json({
            success: true,
            updatedCount: result.recordset[0].UpdatedCount,
            month: month,
            locked: locked
        });
    }
    catch (error) {
        console.error('Error updating month lock status:', error);
        res.status(500).json({ error: 'Failed to update month lock status', details: error.message });
    }
});
// Get allocations with TaskID for a specific month
router.get('/allocations', async (req, res) => {
    try {
        const { month } = req.query; // Format: YYYY-MM-DD (first day of month)
        if (!month) {
            return res.status(400).json({ error: 'Month parameter is required (format: YYYY-MM-DD)' });
        }
        const pool = await (0, database_1.getConnection)();
        const result = await pool
            .request()
            .input('month', database_1.sql.Date, month)
            .query(`
        SELECT 
          a.ResourceID,
          a.ProjectID,
          a.PositionID,
          r.Name as ResourceName,
          p.Name as ProjectName,
          pos.TaskID,
          pos.Fringe_Task,
          a.MonthYear
        FROM dbo.Allocation a
        INNER JOIN dbo.Resources r ON a.ResourceID = r.ID
        INNER JOIN dbo.Projects p ON a.ProjectID = p.ID
        INNER JOIN dbo.Positions pos ON a.PositionID = pos.ID
        WHERE YEAR(a.MonthYear) = YEAR(@month) 
          AND MONTH(a.MonthYear) = MONTH(@month)
      `);
        res.json(result.recordset);
    }
    catch (error) {
        console.error('Error fetching payroll allocations:', error);
        res.status(500).json({ error: 'Failed to fetch payroll allocations', details: error.message });
    }
});
exports.default = router;
