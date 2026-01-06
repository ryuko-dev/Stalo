/**
 * Fix Budget Manager Role Naming
 * 
 * This script updates the SystemUsers table to fix the role naming mismatch
 * Changes "Budget Manager" to "BudgetManager" to match backend RBAC
 */

import sql from 'mssql';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from backend.env
dotenv.config({ path: join(__dirname, '..', 'backend.env') });

const config = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_NAME || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function fixBudgetManagerRole() {
  console.log('🔄 Starting Budget Manager role fix...\n');
  
  let pool;
  
  try {
    // Connect to database
    console.log('Connecting to database...');
    pool = await sql.connect(config);
    console.log('✅ Connected to database\n');

    // Check current state
    console.log('📊 Checking for users with "Budget Manager" role...');
    const checkResult = await pool.request()
      .query(`
        SELECT 
          ID, 
          Name, 
          EmailAddress, 
          Role,
          Active
        FROM SystemUsers
        WHERE Role = 'Budget Manager'
      `);
    
    if (checkResult.recordset.length === 0) {
      console.log('✅ No users found with "Budget Manager" role. Database is already correct.');
      return;
    }
    
    console.log(`\nFound ${checkResult.recordset.length} user(s) with "Budget Manager" role:`);
    checkResult.recordset.forEach(user => {
      console.log(`  - ${user.Name} (${user.EmailAddress}) - Active: ${user.Active ? 'Yes' : 'No'}`);
    });

    // Update the roles
    console.log('\n🔄 Updating roles from "Budget Manager" to "BudgetManager"...');
    const updateResult = await pool.request()
      .query(`
        UPDATE SystemUsers
        SET Role = 'BudgetManager'
        WHERE Role = 'Budget Manager'
      `);
    
    console.log(`✅ Updated ${updateResult.rowsAffected[0]} user(s)\n`);

    // Verify the update
    console.log('✔️ Verifying update...');
    const verifyResult = await pool.request()
      .query(`
        SELECT 
          ID, 
          Name, 
          EmailAddress, 
          Role,
          Active
        FROM SystemUsers
        WHERE Role = 'BudgetManager'
      `);
    
    console.log(`\nUsers now with "BudgetManager" role (${verifyResult.recordset.length}):`);
    verifyResult.recordset.forEach(user => {
      console.log(`  - ${user.Name} (${user.EmailAddress}) - Active: ${user.Active ? 'Yes' : 'No'}`);
    });

    console.log('\n✅ Budget Manager role fix completed successfully!');
    console.log('\n📝 Note: Users with updated roles should now be able to access the system.');
    console.log('   They may need to refresh their browser or log out and back in.');
    
  } catch (error) {
    console.error('❌ Error fixing Budget Manager role:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run the fix
fixBudgetManagerRole()
  .then(() => {
    console.log('\n✅ Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
