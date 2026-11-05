/**
 * Cell Progress Repository - The progress a compound or iterative cell holds
 * Spec Reference: 06-bingo-gameplay.md - Progress on a Cell, Automatic Completion
 *
 * Progress belongs to the cell, so changing it never touches another cell, even one copied
 * from the same resolution. The routes check that the caller owns the card.
 */

import type { CellSubtask } from '../shared/types';
import { GameStatus, ResolutionType } from '../shared/types';
import { CellRow, rowToCell, SELECT_CELL_WITH_RESOLVED_TEXT } from './bingo-card-rows';
import { execute, query } from './connection';
import type { BingoCellDetail } from './types';

interface CellDetailRow extends CellRow {
  game_id: string;
  game_status: GameStatus;
  card_user_id: string;
  description: string | null;
  number_of_repetition: number | null;
  completed_times: number;
}

interface CellSubtaskRow {
  title: string;
  description: string | null;
  completed: number | boolean;
}

/**
 * Load a cell with its copy of the resolution and its progress.
 * @param cellId The cell
 * @returns The cell, or null when it does not exist
 */
export async function getCellDetail(cellId: string): Promise<BingoCellDetail | null> {
  const rows = await query<CellDetailRow[]>(
    `SELECT cell.*, g.id AS game_id, g.status AS game_status, bc.user_id AS card_user_id,
            c.description, c.number_of_repetition, c.completed_times
     FROM (${SELECT_CELL_WITH_RESOLVED_TEXT} WHERE c.id = ?) cell
     JOIN bingo_cells c ON c.id = cell.id
     JOIN bingo_cards bc ON bc.id = c.card_id
     JOIN games g ON g.id = bc.game_id`,
    [cellId]
  );
  if (rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const isCompound = row.resolution_type === ResolutionType.COMPOUND;
  const isIterative = row.resolution_type === ResolutionType.ITERATIVE;
  const subtasks = isCompound ? await getCellSubtasks(cellId) : null;

  return {
    ...rowToCell(row),
    gameId: row.game_id,
    gameStatus: row.game_status,
    cardUserId: row.card_user_id,
    description: row.description,
    subtasks,
    numberOfRepetition: isIterative ? row.number_of_repetition : null,
    completedTimes: row.completed_times,
  };
}

/**
 * List the subtasks of a compound cell, in order.
 * @param cellId The cell
 * @returns The subtasks with their progress
 */
async function getCellSubtasks(cellId: string): Promise<CellSubtask[]> {
  const rows = await query<CellSubtaskRow[]>(
    `SELECT title, description, completed FROM bingo_cell_subtasks
     WHERE cell_id = ? ORDER BY subtask_index`,
    [cellId]
  );
  return rows.map((row) => ({
    title: row.title,
    description: row.description ?? '',
    completed: Boolean(row.completed),
  }));
}

/**
 * Whether a compound or iterative cell has reached its goal.
 * @param cell The cell
 * @returns True if every subtask is done or the counter reached its target
 */
export function isCellProgressComplete(
  cell: Pick<BingoCellDetail, 'resolutionType' | 'subtasks' | 'completedTimes' | 'numberOfRepetition'>
): boolean {
  if (cell.resolutionType === ResolutionType.COMPOUND) {
    return cell.subtasks?.every((subtask) => subtask.completed) ?? false;
  }
  return cell.completedTimes >= (cell.numberOfRepetition ?? Infinity);
}

/**
 * Toggle one subtask of a compound cell.
 * @param cellId The cell
 * @param subtaskIndex The 0-based subtask position
 * @returns True if the subtask exists and was toggled
 */
export async function toggleCellSubtask(cellId: string, subtaskIndex: number): Promise<boolean> {
  const result = await execute(
    `UPDATE bingo_cell_subtasks SET completed = 1 - completed WHERE cell_id = ? AND subtask_index = ?`,
    [cellId, subtaskIndex]
  );
  return result.affectedRows > 0;
}

/**
 * Move the counter of an iterative cell one step. It never goes below zero.
 * @param cellId The cell
 * @param delta 1 to increment, -1 to decrement
 */
export async function adjustCellIterativeProgress(cellId: string, delta: 1 | -1): Promise<void> {
  await execute(
    `UPDATE bingo_cells SET completed_times = GREATEST(completed_times + ?, 0) WHERE id = ?`,
    [delta, cellId]
  );
}
