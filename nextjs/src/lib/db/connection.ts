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

/** Anything that can run a statement: the pool, or a connection inside a transaction. */
export type Executor = Pick<mysql.Pool, 'execute'>;

/**
 * Run a statement and return its rows.
 * @param sql The statement to run
 * @param params The statement's placeholder values
 * @param executor Where to run it; pass the transaction's connection to run inside it
 * @returns The rows, typed as T
 */
export async function query<T>(sql: string, params?: unknown[], executor: Executor = getPool()): Promise<T> {
  const [rows] = await executor.execute(sql, params);
  return rows as T;
}

/**
 * Run a write statement and return its result header.
 * @param sql The statement to run
 * @param params The statement's placeholder values
 * @param executor Where to run it; pass the transaction's connection to run inside it
 * @returns The header, whose affectedRows tells whether a guarded write matched
 */
export async function execute(
  sql: string,
  params?: unknown[],
  executor: Executor = getPool()
): Promise<mysql.ResultSetHeader> {
  const [header] = await executor.execute<mysql.ResultSetHeader>(sql, params);
  return header;
}

/**
 * Run work inside a transaction on its own connection.
 * The transaction rolls back when the work throws, and the error is rethrown.
 * @param work The statements to run, given the transaction's connection
 * @param shouldCommit Decides from the result whether to commit or roll back; commits by default
 * @returns The value returned by work
 */
export async function withTransaction<T>(
  work: (connection: mysql.PoolConnection) => Promise<T>,
  shouldCommit: (result: T) => boolean = () => true
): Promise<T> {
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    const result = await work(connection);

    if (shouldCommit(result)) {
      await connection.commit();
    } else {
      await connection.rollback();
    }

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
