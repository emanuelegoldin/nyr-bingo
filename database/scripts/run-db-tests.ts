import mysql from 'mysql2/promise';
import { spawn } from 'child_process';
import { readFile, readdir } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { schema } from './schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseDbName = process.env.DB_NAME || 'resolution_bingo';
const testDbName = `${baseDbName}_test`;

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

function splitSqlStatements(sqlText: string): string[] {
  const statements: string[] = [];
  let currentDelimiter = ';';
  let buffer = '';

  const lines = sqlText.split(/\r?\n/);
  for (const line of lines) {
    const delimiterMatch = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (delimiterMatch) {
      const trimmed = buffer.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
        buffer = '';
      }
      currentDelimiter = delimiterMatch[1];
      continue;
    }

    buffer += `${line}\n`;

    if (buffer.trim().endsWith(currentDelimiter)) {
      const statement = buffer.trim().slice(0, -currentDelimiter.length).trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
      buffer = '';
    }
  }

  const remaining = buffer.trim();
  if (remaining.length > 0) {
    statements.push(remaining);
  }

  return statements;
}

async function applySchema(connection: mysql.Connection): Promise<void> {
  console.log('Applying database schema...');
  const statements = splitSqlStatements(schema);
  for (const statement of statements) {
    try {
      await connection.execute(statement);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error applying schema. Error: ${errorMessage}\nStatement: ${statement.substring(0, 100)}...`);
      throw error;
    }
  }
  console.log('Database schema created successfully!');
}

async function applyMigrations(connection: mysql.Connection): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../../database-migrations');
  const migrationFiles: string[] = await readdir(migrationsDir)
    .then(files => files.filter(file => file.endsWith('.sql')));

  console.log(`Starting to apply ${migrationFiles.length} migration(s)...`);
  for (const file of migrationFiles) {
    console.log(`Applying migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sqlText = await readFile(filePath, 'utf8');
    const statements = splitSqlStatements(sqlText);
    for (const statement of statements) {
      try
      {
          await connection.query(statement);
      }
      catch (error: unknown)
      {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`Error executing statement ${statement.substring(0, 100)} from migration ${file}.\nError: ${errorMessage}`);
          throw error;
      }
    }
  }
  console.log('All migrations applied successfully!');
}

async function runJest(): Promise<number> {
  return new Promise((resolve, reject) => {
    const jestProcess = spawn('pnpm', ['jest', '--config', 'jest.db.config.ts'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        DB_NAME: testDbName,
      },
    });

    jestProcess.on('close', code => resolve(code ?? 1));
    jestProcess.on('error', error => reject(error));
  });
}

async function run(): Promise<void> {
  const adminConnection = await mysql.createConnection(dbConfig);

  try {
    await adminConnection.execute(`DROP DATABASE IF EXISTS \`${testDbName}\``);
    await adminConnection.execute(`CREATE DATABASE \`${testDbName}\``);
    await adminConnection.changeUser({ database: testDbName });

    await applySchema(adminConnection);
    await applyMigrations(adminConnection);
  } finally {
    await adminConnection.end();
  }

  let exitCode = 1;
  try {
    exitCode = await runJest();
  } finally {
    const cleanupConnection = await mysql.createConnection(dbConfig);
    try {
      await cleanupConnection.execute(`DROP DATABASE IF EXISTS \`${testDbName}\``);
    } finally {
      await cleanupConnection.end();
    }
  }

  process.exit(exitCode);
}

run().catch(error => {
  console.error('DB test runner failed:', error);
  process.exit(1);
});
