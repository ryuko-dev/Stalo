const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend.env') });

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: false
  }
};

(async () => {
  try {
    console.log('Connecting to database...');
    await sql.connect(config);
    console.log('Connected successfully');

    const sqlScript = fs.readFileSync(path.join(__dirname, 'add_track_column.sql'), 'utf8');
    
    // Split by GO statements
    const batches = sqlScript.split(/\r?\nGO\r?\n/i).filter(b => b.trim());
    
    console.log(`Executing ${batches.length} batch(es)...`);
    
    for (const batch of batches) {
      if (batch.trim()) {
        await sql.query(batch);
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('Track column has been added to dbo.Resources');
    
    await sql.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error(err);
    process.exit(1);
  }
})();
