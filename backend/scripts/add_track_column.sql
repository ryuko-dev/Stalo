-- Add Track column to Resources table
-- This column controls whether a resource appears in the home page allocation table
-- Default value is 1 (true) so all existing resources will be tracked by default

-- Check if column exists before adding it
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Resources') AND name = 'Track')
BEGIN
    ALTER TABLE dbo.Resources
    ADD Track BIT NOT NULL DEFAULT 1;
    
    PRINT 'Track column added successfully to dbo.Resources';
END
ELSE
BEGIN
    PRINT 'Track column already exists in dbo.Resources';
END
GO

-- Update all existing resources to be tracked by default (if any have NULL values)
UPDATE dbo.Resources
SET Track = 1
WHERE Track IS NULL;
GO

PRINT 'All existing resources set to Track = 1 (tracked)';
GO
