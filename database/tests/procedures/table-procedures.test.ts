import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../helpers/db-client';

type CountRow = RowDataPacket & { count: number };

describe('stored procedure: table utilities', () => {
  test('Create_Table creates a new table', async () => {
    const tableName = 'jest_proc_create_table';

    await execute('CALL Drop_Table(?)', [tableName]);
    await execute('CALL Create_Table(?, ?)', [tableName, 1]);

    const rows = await query<CountRow[]>(
      'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [tableName]
    );

    expect(rows[0].count).toBe(1);

    await execute('CALL Drop_Table(?)', [tableName]);
  });

  test('Create_Column adds a column to an existing table', async () => {
    const tableName = 'jest_proc_create_column';
    const columnName = 'display_name';

    await execute('CALL Drop_Table(?)', [tableName]);
    await execute('CALL Create_Table(?, ?)', [tableName, 0]);
    await execute('CALL Create_Column(?, ?, ?, ?, ?, ?, ?, ?)', [
      tableName,
      columnName,
      'VARCHAR(255)',
      1,
      null,
      null,
      null,
      null,
    ]);

    const rows = await query<CountRow[]>(
      'SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [tableName, columnName]
    );

    expect(rows[0].count).toBe(1);

    await execute('CALL Drop_Table(?)', [tableName]);
  });
});
