-- Drop BudgetChangeHistory table if it exists
IF OBJECT_ID('dbo.BudgetChangeHistory', 'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.BudgetChangeHistory;
    PRINT '✅ Dropped BudgetChangeHistory table';
END
ELSE
BEGIN
    PRINT 'ℹ️  BudgetChangeHistory table does not exist';
END
