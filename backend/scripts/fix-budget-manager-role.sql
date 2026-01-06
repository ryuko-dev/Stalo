-- Fix Budget Manager role naming issue
-- Changes "Budget Manager" (with space) to "BudgetManager" (no space)
-- to match backend RBAC implementation

-- Check current state
SELECT 
    ID, 
    Name, 
    EmailAddress, 
    Role,
    Active
FROM dbo.SystemUsers
WHERE Role = 'Budget Manager';

-- Update all instances
UPDATE dbo.SystemUsers
SET Role = 'BudgetManager'
WHERE Role = 'Budget Manager';

-- Verify the update
SELECT 
    ID, 
    Name, 
    EmailAddress, 
    Role,
    Active
FROM dbo.SystemUsers
WHERE Role = 'BudgetManager';

-- Show affected users count
SELECT 
    'Users updated' AS Message,
    COUNT(*) AS Count
FROM dbo.SystemUsers
WHERE Role = 'BudgetManager';
