/**
 * Test replacement for lib/db/connection: every statement runs on one pinned connection
 * inside a per-test transaction that is rolled back, so each test starts from the same DB.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import mysql from 'mysql2/promise';

/** Anything that can run a statement: the pinned connection, or the one handed to withTransaction. */
export type Executor = Pick<mysql.Pool, 'execute'>;

// TEST_DB_* (not DB_*) and port 3307, so the tests never reach a development or production database
const testDbConfig: mysql.PoolOptions = {
  host: process.env.TEST_DB_HOST || '127.0.0.1',
  port: parseInt(process.env.TEST_DB_PORT || '3307', 10),
  user: process.env.TEST_DB_USER || 'root',
  password: process.env.TEST_DB_PASSWORD || 'test',
  database: process.env.TEST_DB_NAME || 'resolution_bingo',
  connectionLimit: 1,
};

let pool: mysql.Pool | null = null;
let pinnedConnection: mysql.PoolConnection | null = null;
let savepointCounter = 0;

/**
 * Open the single connection that all statements of the current test file share.
 * @returns Nothing; call once before the file's tests
 */
export const openTestConnection = async (): Promise<void> => {
  pool = mysql.createPool(testDbConfig);
  pinnedConnection = await pool.getConnection();
};

/**
 * Release the pinned connection and close the pool.
 * @returns Nothing; call once after the file's tests
 */
export const closeTestConnection = async (): Promise<void> => {
  pinnedConnection?.release();
  pinnedConnection = null;
  await pool?.end();
  pool = null;
};

/**
 * The pinned connection, failing loudly if the setup hooks did not open it.
 * @returns The connection every statement runs on
 */
const getPinnedConnection = (): mysql.PoolConnection => {
  if (!pinnedConnection) {
    throw new Error('Test DB connection is not open; is tests/db/support/setup.ts in setupFiles?');
  }
  return pinnedConnection;
};

/**
 * Start the transaction that wraps one test.
 * @returns Nothing; call before each test
 */
export const beginTestTransaction = async (): Promise<void> => {
  await getPinnedConnection().query('START TRANSACTION');
};

/**
 * Undo everything the test wrote.
 * @returns Nothing; call after each test
 */
export const rollbackTestTransaction = async (): Promise<void> => {
  await getPinnedConnection().query('ROLLBACK');
};

/**
 * Run a statement and return its rows. Same contract as lib/db/connection.
 * @param sql The statement to run
 * @param params The statement's placeholder values
 * @param executor Where to run it; defaults to the pinned connection
 * @returns The rows, typed as T
 */
export async function query<T>(sql: string, params?: unknown[], executor: Executor = getPinnedConnection()): Promise<T> {
  const [rows] = await executor.execute(sql, params);
  return rows as T;
}

/**
 * Run a write statement and return its result header. Same contract as lib/db/connection.
 * @param sql The statement to run
 * @param params The statement's placeholder values
 * @param executor Where to run it; defaults to the pinned connection
 * @returns The header, whose affectedRows tells whether a guarded write matched
 */
export async function execute(
  sql: string,
  params?: unknown[],
  executor: Executor = getPinnedConnection()
): Promise<mysql.ResultSetHeader> {
  const [header] = await executor.execute<mysql.ResultSetHeader>(sql, params);
  return header;
}

/**
 * Run work as a nested unit inside the test transaction, using a savepoint.
 * Keeps the production contract: rolls back when work throws (and rethrows),
 * or when shouldCommit returns false; otherwise keeps the work until the test ends.
 * @param work The statements to run, given the pinned connection
 * @param shouldCommit Decides from the result whether to keep or undo the work; keeps it by default
 * @returns The value returned by work
 */
export async function withTransaction<T>(
  work: (connection: mysql.PoolConnection) => Promise<T>,
  shouldCommit: (result: T) => boolean = () => true
): Promise<T> {
  const connection = getPinnedConnection();
  savepointCounter += 1;
  const savepoint = `test_sp_${savepointCounter}`;

  await connection.query(`SAVEPOINT ${savepoint}`);

  try {
    const result = await work(connection);

    if (shouldCommit(result)) {
      await connection.query(`RELEASE SAVEPOINT ${savepoint}`);
    } else {
      await connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    }

    return result;
  } catch (error) {
    await connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    throw error;
  }
}
