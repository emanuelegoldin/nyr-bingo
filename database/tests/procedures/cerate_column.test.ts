import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../helpers/db-client';

const unittestTableName = 'unittest_table';

/**
 * Create_Column
 *   p_tableName VARCHAR(255),
 *   p_columnName VARCHAR(255),
 *   p_columnType VARCHAR(255),
 *   p_isNullable BOOLEAN,
 *   p_defaultValue TEXT,
 *   p_referencedTable VARCHAR(255),
 *   p_onDeleteAction VARCHAR(255),
 */

afterEach(async () => {
  await execute('CALL Drop_Table(?)', [unittestTableName]);
});

describe('stored procedure: Create_Column', () => {
  test('Create_Column adds a column to an existing table', async () => {
    // ARRANGE
    await execute('CALL Create_Table(?, ?)', [unittestTableName, 1]);

    // ACT
    await execute('CALL Create_Column(?, ?, ?, ?, ?, ?, ?, ?)', [
      unittestTableName,
      'display_name',
      'VARCHAR(255)',
      1,
      null,
      null,
      null,
      null,
    ]);

    // ASSERT
    const rows = await query<RowDataPacket>(
      'SELECT * ' +
      'FROM INFORMATION_SCHEMA.COLUMNS ' +
      'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [unittestTableName, 'display_name']
    );

    expect(rows.length).toBe(1);
    expect(rows[0].COLUMN_NAME).toBe('display_name');
    expect(rows[0].DATA_TYPE).toBe('varchar');
    expect(rows[0].CHARACTER_MAXIMUM_LENGTH).toBe(255);
  });
});
