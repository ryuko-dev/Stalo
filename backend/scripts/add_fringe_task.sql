-- Add Fringe_Task column to positions table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'positions' AND COLUMN_NAME = 'Fringe_Task')
BEGIN
  ALTER TABLE dbo.positions ADD Fringe_Task NVARCHAR(255) NULL
END
GO
