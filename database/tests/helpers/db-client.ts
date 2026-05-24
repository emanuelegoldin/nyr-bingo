import mysql from 'mysql2/promise';

let connection: mysql.Connection | null = null;

function getConfig(): mysql.ConnectionOptions {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'resolution_bingo_test',
    multipleStatements: true,
  };
}

export async function getTestConnection(): Promise<mysql.Connection> {
  if (!connection) {
    connection = await mysql.createConnection(getConfig());
  }
  return connection;
}

export async function closeTestConnection(): Promise<void> {
  if (connection) {
    await connection.end();
    connection = null;
  }
}

export async function execute<T>(sql: string, params?: Array<string | number | null>): Promise<T> {
  const conn = await getTestConnection();
  const [rows] = await conn.execute(sql, params);
  return rows as T;
}

export async function query<T>(sql: string, params?: Array<string | number | null>): Promise<T> {
  const conn = await getTestConnection();
  const [rows] = await conn.query(sql, params);
  return rows as T;
}
