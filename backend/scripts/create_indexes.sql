-- Performance Optimization: Database Indexes for Stalo Application
-- Run this script against your Azure SQL Database to improve query performance
-- These indexes support the most common query patterns in the application

-- ============================================
-- Indexes for dbo.Positions table
-- ============================================

-- Index for filtering positions by project
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Positions_Project' AND object_id = OBJECT_ID('dbo.Positions'))
BEGIN
    CREATE INDEX IX_Positions_Project ON dbo.Positions(Project);
    PRINT 'Created index IX_Positions_Project';
END
ELSE
    PRINT 'Index IX_Positions_Project already exists';
GO

-- Index for filtering positions by MonthYear (commonly used in date range queries)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Positions_MonthYear' AND object_id = OBJECT_ID('dbo.Positions'))
BEGIN
    CREATE INDEX IX_Positions_MonthYear ON dbo.Positions(MonthYear);
    PRINT 'Created index IX_Positions_MonthYear';
END
ELSE
    PRINT 'Index IX_Positions_MonthYear already exists';
GO

-- Index for filtering positions by Allocated status
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Positions_Allocated' AND object_id = OBJECT_ID('dbo.Positions'))
BEGIN
    CREATE INDEX IX_Positions_Allocated ON dbo.Positions(Allocated);
    PRINT 'Created index IX_Positions_Allocated';
END
ELSE
    PRINT 'Index IX_Positions_Allocated already exists';
GO

-- Composite index for common query pattern: filtering by MonthYear and Allocated
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Positions_MonthYear_Allocated' AND object_id = OBJECT_ID('dbo.Positions'))
BEGIN
    CREATE INDEX IX_Positions_MonthYear_Allocated ON dbo.Positions(MonthYear, Allocated) INCLUDE (Project, PositionName, LoE, AllocationMode);
    PRINT 'Created index IX_Positions_MonthYear_Allocated';
END
ELSE
    PRINT 'Index IX_Positions_MonthYear_Allocated already exists';
GO

-- ============================================
-- Indexes for dbo.Allocation table
-- ============================================

-- Index for filtering/joining allocations by PositionID
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_PositionID' AND object_id = OBJECT_ID('dbo.Allocation'))
BEGIN
    CREATE INDEX IX_Allocation_PositionID ON dbo.Allocation(PositionID);
    PRINT 'Created index IX_Allocation_PositionID';
END
ELSE
    PRINT 'Index IX_Allocation_PositionID already exists';
GO

-- Index for filtering/joining allocations by ResourceID
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_ResourceID' AND object_id = OBJECT_ID('dbo.Allocation'))
BEGIN
    CREATE INDEX IX_Allocation_ResourceID ON dbo.Allocation(ResourceID);
    PRINT 'Created index IX_Allocation_ResourceID';
END
ELSE
    PRINT 'Index IX_Allocation_ResourceID already exists';
GO

-- Index for filtering/joining allocations by ProjectID
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_ProjectID' AND object_id = OBJECT_ID('dbo.Allocation'))
BEGIN
    CREATE INDEX IX_Allocation_ProjectID ON dbo.Allocation(ProjectID);
    PRINT 'Created index IX_Allocation_ProjectID';
END
ELSE
    PRINT 'Index IX_Allocation_ProjectID already exists';
GO

-- Index for filtering allocations by MonthYear
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_MonthYear' AND object_id = OBJECT_ID('dbo.Allocation'))
BEGIN
    CREATE INDEX IX_Allocation_MonthYear ON dbo.Allocation(MonthYear);
    PRINT 'Created index IX_Allocation_MonthYear';
END
ELSE
    PRINT 'Index IX_Allocation_MonthYear already exists';
GO

-- Composite index for common query pattern: ResourceID + MonthYear (used in Home page)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Allocation_ResourceID_MonthYear' AND object_id = OBJECT_ID('dbo.Allocation'))
BEGIN
    CREATE INDEX IX_Allocation_ResourceID_MonthYear ON dbo.Allocation(ResourceID, MonthYear) INCLUDE (ProjectID, PositionID, LoE, AllocationMode);
    PRINT 'Created index IX_Allocation_ResourceID_MonthYear';
END
ELSE
    PRINT 'Index IX_Allocation_ResourceID_MonthYear already exists';
GO

-- ============================================
-- Indexes for dbo.Resources table
-- ============================================

-- Index for filtering/joining resources by Entity
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Resources_Entity' AND object_id = OBJECT_ID('dbo.Resources'))
BEGIN
    CREATE INDEX IX_Resources_Entity ON dbo.Resources(Entity);
    PRINT 'Created index IX_Resources_Entity';
END
ELSE
    PRINT 'Index IX_Resources_Entity already exists';
GO

-- Index for filtering resources by StartDate/EndDate (used for active resource filtering)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Resources_StartDate_EndDate' AND object_id = OBJECT_ID('dbo.Resources'))
BEGIN
    CREATE INDEX IX_Resources_StartDate_EndDate ON dbo.Resources(StartDate, EndDate) INCLUDE (Name, Department, ResourceType);
    PRINT 'Created index IX_Resources_StartDate_EndDate';
END
ELSE
    PRINT 'Index IX_Resources_StartDate_EndDate already exists';
GO

-- ============================================
-- Summary
-- ============================================
PRINT '';
PRINT '========================================';
PRINT 'Index creation complete!';
PRINT 'Run this script once on your Azure SQL database.';
PRINT 'These indexes will significantly improve query performance.';
PRINT '========================================';
