const sql = require('mssql');
require('dotenv').config({ path: 'backend.env' });

async function addFringeTask() {
  const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: true, trustServerCertificate: false }
  };
  
  console.log('Connecting to:', config.server, config.database);
  
  await sql.connect(config);
  
  // First check current columns
  const cols = await sql.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Positions' ORDER BY ORDINAL_POSITION`);
  console.log('Current columns:', cols.recordset.map(r => r.COLUMN_NAME));
  
  // Add Fringe_Task column if it doesn't exist
  await sql.query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Positions' AND COLUMN_NAME = 'Fringe_Task')
    BEGIN
      ALTER TABLE dbo.Positions ADD Fringe_Task NVARCHAR(255) NULL
    END
  `);
  
  console.log('Fringe_Task column added successfully');
  
  // Verify
  const result = await sql.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Positions' ORDER BY ORDINAL_POSITION`);
  console.log('Updated columns:', result.recordset.map(r => r.COLUMN_NAME));
  
  await sql.close();
}

addFringeTask().catch(console.error);
