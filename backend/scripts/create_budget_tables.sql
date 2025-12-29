-- Budget Versions Table
CREATE TABLE BudgetVersions (
    Version_ID INT IDENTITY(1,1) PRIMARY KEY,
    Job_No NVARCHAR(20) NOT NULL,
    Version_Name NVARCHAR(100) NOT NULL,
    Version_Description NVARCHAR(500),
    
    -- Status
    Is_Active BIT DEFAULT 1,
    Is_Baseline BIT DEFAULT 0,
    
    -- Audit trail
    Created_By NVARCHAR(100) NOT NULL,
    Created_Date DATETIME DEFAULT GETDATE(),
    Modified_By NVARCHAR(100),
    Modified_Date DATETIME,
    
    -- Source tracking
    Source_Type NVARCHAR(20),  -- 'Excel Upload', 'Manual Edit', 'Copy'
    Source_Version_ID INT,
    
    CONSTRAINT UQ_BudgetVersion_Name UNIQUE (Job_No, Version_Name),
    FOREIGN KEY (Source_Version_ID) REFERENCES BudgetVersions(Version_ID)
);

-- Budget Data Table
CREATE TABLE BudgetData (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Version_ID INT NOT NULL,
    Job_No NVARCHAR(20) NOT NULL,
    Job_Task_No NVARCHAR(20) NOT NULL,
    Budget_Month DATE NOT NULL,
    Budget_Amount DECIMAL(18,2) NOT NULL DEFAULT 0,
    
    -- Track cell-level changes
    Last_Modified_By NVARCHAR(100),
    Last_Modified_Date DATETIME,
    
    FOREIGN KEY (Version_ID) REFERENCES BudgetVersions(Version_ID) ON DELETE CASCADE,
    CONSTRAINT UQ_BudgetData_VersionMonth UNIQUE (Version_ID, Job_No, Job_Task_No, Budget_Month)
);

-- Indexes for performance
CREATE INDEX IX_BudgetVersions_JobNo ON BudgetVersions(Job_No);
CREATE INDEX IX_BudgetData_VersionID ON BudgetData(Version_ID);
CREATE INDEX IX_BudgetData_JobNo ON BudgetData(Job_No, Job_Task_No);
CREATE INDEX IX_BudgetData_Month ON BudgetData(Budget_Month);

PRINT 'Budget tables created successfully';
