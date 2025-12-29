"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
exports.getConnection = getConnection;
exports.getDbConfig = getDbConfig;
const mssql_1 = __importDefault(require("mssql"));
exports.sql = mssql_1.default;
const getConfig = () => ({
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
    pool: {
        max: 20, // Increased from 10 for better concurrency
        min: 2, // Keep minimum connections warm
        idleTimeoutMillis: 30000,
    },
    connectionTimeout: 60000,
});
let pool = null;
async function getConnection() {
    try {
        if (!pool || pool.connected === false) {
            console.log('Establishing new database connection...');
            const config = getConfig();
            console.log(`Connecting to database server: ${config.server}`);
            pool = await mssql_1.default.connect(config);
            console.log('Database connection established successfully');
        }
        return pool;
    }
    catch (error) {
        console.error('Database connection failed:', error);
        pool = null;
        throw error;
    }
}
function getDbConfig() {
    return getConfig();
}
