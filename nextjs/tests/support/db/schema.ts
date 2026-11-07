/**
 * Helpers for structure tests: read a table's columns from information_schema.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { query } from './test-connection';

/** One column as a structure test compares it. */
export interface ColumnShape {
  name: string;
  /** Full MariaDB type, e.g. varchar(36), tinyint(1), enum('a','b') */
  type: string;
  nullable: boolean;
  /** True for generated (computed) columns */
  generated: boolean;
}

interface ColumnRow {
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: 'YES' | 'NO';
  IS_GENERATED: 'ALWAYS' | 'NEVER';
}

/**
 * Read the columns of a table in the current database, in table order.
 * @param table The table name
 * @returns The columns; an empty list when the table does not exist
 */
export const getColumns = async (table: string): Promise<ColumnShape[]> => {
  const rows = await query<ColumnRow[]>(
    `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, IS_GENERATED
       FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?
      ORDER BY ORDINAL_POSITION`,
    [table]
  );

  return rows.map((row) => ({
    name: row.COLUMN_NAME,
    type: row.COLUMN_TYPE,
    nullable: row.IS_NULLABLE === 'YES',
    generated: row.IS_GENERATED === 'ALWAYS',
  }));
};
