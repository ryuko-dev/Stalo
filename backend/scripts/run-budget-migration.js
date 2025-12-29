const sql = require('mssql');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend.env') });

const config = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    connectTimeout: 60000,
    requestTimeout: 60000,
  },
};

async function runMigration() {
  console.log('🚀 Starting budget tables migration...');
  console.log(`📊 Database: ${config.database}`);
  console.log(`🖥️  Server: ${config.server}`);
  
  let pool;
  try {
    // Connect to database
    console.log('🔌 Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected successfully');

    // Read SQL file
    const sqlFile = path.join(__dirname, 'create_budget_tables.sql');
    console.log(`📄 Reading SQL file: ${sqlFile}`);
    const sqlScript = fs.readFileSync(sqlFile, 'utf8');

    // Split by GO statements and execute each batch
    const batches = sqlScript
      .split(/\nGO\n/gi)
      .filter(batch => batch.trim().length > 0);

    console.log(`📝 Executing ${batches.length} SQL batch(es)...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (batch) {
        console.log(`   Batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batch);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('📋 Tables created:');
    console.log('   - BudgetVersions');
    console.log('   - BudgetData');
    console.log('   - BudgetChangeHistory');
    console.log('   + Indexes created');
    
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.message.includes('already an object')) {
      console.log('ℹ️  Tables might already exist. You can check Azure Portal.');
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
      console.log('🔌 Database connection closed');
    }
  }
}

runMigration();
