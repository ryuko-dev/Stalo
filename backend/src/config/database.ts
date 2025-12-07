import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config: sql.config = {
  server: process.env.DB_SERVER || '',
  database: process.env.DB_DATABASE || '',
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  options: {
    encrypt: true,
    trustServerCertificate: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

export { sql };
