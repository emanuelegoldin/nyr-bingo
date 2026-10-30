/**
 * MariaDB Database Connection
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import mysql from 'mysql2/promise';

// Warn if sensitive database configuration is using defaults in non-development environments
if (process.env.NODE_ENV !== 'development' && !process.env.DB_PASSWORD) {
  console.warn(
    '[SECURITY WARNING] DB_PASSWORD is not set. Using empty password default is a security risk in production. ' +
    'Please set the DB_PASSWORD environment variable.'
  );
}

// Database configuration from environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'resolution_bingo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

// Create connection pool for efficient database access
let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function query<T>(sql: string, params?: unknown[]): Promise<T> {
  const connection = getPool();
  const [rows] = await connection.execute(sql, params);
  return rows as T;
}

export async function getConnection(): Promise<mysql.PoolConnection> {
  return getPool().getConnection();
}
