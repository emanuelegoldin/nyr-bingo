/**
 * Helpers for assertions: count the rows of a table that match a condition, bypassing the repositories.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { query } from './test-connection';

/**
 * Count the rows of a table that match a condition.
 * @param table The table name (a literal from the test, never user input)
 * @param where The condition, with ? placeholders
 * @param params The values for the placeholders
 * @returns The number of matching rows
 */
export const countRows = async (table: string, where: string, params: unknown[]): Promise<number> => {
  const rows = await query<{ total: number }[]>(`SELECT COUNT(*) AS total FROM ${table} WHERE ${where}`, params);
  return Number(rows[0].total);
};
