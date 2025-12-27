-- Audit Log Table for Role Changes
CREATE TABLE dbo.RoleAuditLog (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    UserID NVARCHAR(50) NOT NULL,
    UserName NVARCHAR(255),
    UserEmail NVARCHAR(255),
    OldRole NVARCHAR(100),
    NewRole NVARCHAR(100),
    ChangedBy NVARCHAR(255),
    ChangedAt DATETIME2 DEFAULT GETUTCDATE(),
    FOREIGN KEY (UserID) REFERENCES dbo.SystemUsers(ID)
);

-- Index for faster queries
CREATE INDEX IX_RoleAuditLog_UserID ON dbo.RoleAuditLog(UserID);
CREATE INDEX IX_RoleAuditLog_ChangedAt ON dbo.RoleAuditLog(ChangedAt DESC);
