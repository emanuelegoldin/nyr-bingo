import type { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../helpers/db-client';

//type CountRow = RowDataPacket & { count: number };

const unittestTableName = 'unittest_table';

afterEach(async () => {
  await execute('CALL Drop_Table(?)', [unittestTableName]);
});

describe('stored procedure: table utilities', () => {
  // Create_Table
  test('Create_Table creates a new table', async () => {
    // ARRANGE
    
    // ACT
    await execute('CALL Create_Table(?, ?)', [unittestTableName, 1]);

    // ASSERT
    const rows = await query<RowDataPacket[]>(
      'SELECT COUNT(*) AS count ' +
      'FROM INFORMATION_SCHEMA.TABLES ' +
      'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [unittestTableName]
    );

    expect(rows[0].count).toBe(1);
  });
});
