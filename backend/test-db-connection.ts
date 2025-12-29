
import dotenv from 'dotenv';
import path from 'path';
import { getConnection } from './src/config/database';

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'backend.env') });

async function testConnection() {
  console.log('Testing database connection...');
  console.log('DB_SERVER:', process.env.DB_SERVER);
  console.log('DB_DATABASE:', process.env.DB_DATABASE);
  console.log('DB_USER:', process.env.DB_USER);
  
  try {
    const pool = await getConnection();
    console.log('Successfully connected to database!');
    await pool.close();
    process.exit(0);
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

testConnection();
