/**
 * Helpers shared by the gameplay DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { CellSourceType, CellState } from '@/lib/shared/types';
import { query } from '../../support/db/test-connection';

/** The persisted fields of a cell that the tests look at. */
export interface StoredCell {
  state: CellState;
  source_type: CellSourceType;
  resolution_id: string | null;
  title: string | null;
  is_empty: number;
}

/**
 * Read a cell straight from the table, bypassing the repository.
 * @param cellId The cell
 * @returns The stored fields
 */
export const readCell = async (cellId: string): Promise<StoredCell> => {
  const rows = await query<StoredCell[]>(
    'SELECT state, source_type, resolution_id, title, is_empty FROM bingo_cells WHERE id = ?',
    [cellId]
  );
  return rows[0];
};

/**
 * Read a cell's state straight from the table.
 * @param cellId The cell
 * @returns The stored state
 */
export const readState = async (cellId: string): Promise<CellState> => {
  const rows = await query<{ state: CellState }[]>('SELECT state FROM bingo_cells WHERE id = ?', [cellId]);
  return rows[0].state;
};

/**
 * Read the completed flags of a cell's subtasks, in order.
 * @param cellId The cell
 * @returns 0 or 1 per subtask
 */
export const readSubtaskFlags = async (cellId: string): Promise<number[]> => {
  const rows = await query<{ completed: number }[]>(
    'SELECT completed FROM bingo_cell_subtasks WHERE cell_id = ? ORDER BY subtask_index',
    [cellId]
  );
  return rows.map((row) => Number(row.completed));
};

/**
 * Read a cell's iterative counter.
 * @param cellId The cell
 * @returns completed_times
 */
export const readCounter = async (cellId: string): Promise<number> => {
  const rows = await query<{ completed_times: number }[]>('SELECT completed_times FROM bingo_cells WHERE id = ?', [cellId]);
  return rows[0].completed_times;
};
