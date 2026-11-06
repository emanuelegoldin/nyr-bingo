/**
 * Cell Reaction Repository - Teammates' emoji reactions on stamped cells
 * Spec Reference: 24-cell-reactions.md
 */

import type { PoolConnection } from 'mysql2/promise';
import {
  REACTABLE_CELL_STATES,
  REACTION_SPOT_MAX,
  REACTION_SPOT_MIN,
  type CellReaction,
  type ReactionId,
} from '../shared/reactions';
import type { CellState } from '../shared/types';
import { execute, query } from './connection';

/** A row of `cell_reactions`, as read for display. */
export interface CellReactionRow {
  cell_id: string;
  user_id: string;
  reaction: ReactionId;
  pos_x: number;
  pos_y: number;
}

/** What the reaction routes check about a cell before acting on it. */
export interface CellReactionTarget {
  gameId: string;
  cardUserId: string;
  state: CellState;
}

/** SQL list of the stamped states, which are fixed values and safe to inline. */
const STAMPED_STATES_SQL = REACTABLE_CELL_STATES.map((state) => `'${state}'`).join(', ');

/**
 * Turn a reaction row into its API shape.
 *
 * @param row - The row.
 * @returns The reaction.
 */
export function rowToReaction(row: CellReactionRow): CellReaction {
  return { userId: row.user_id, reaction: row.reaction, x: row.pos_x, y: row.pos_y };
}

/**
 * Pick a random spot for a new reaction, inside the bounds that keep it in the cell.
 *
 * @returns A whole percentage between `REACTION_SPOT_MIN` and `REACTION_SPOT_MAX`.
 */
function randomSpot(): number {
  return REACTION_SPOT_MIN + Math.floor(Math.random() * (REACTION_SPOT_MAX - REACTION_SPOT_MIN + 1));
}

/**
 * Load what the reaction routes need to know about a stored cell.
 *
 * @param cellId - The cell.
 * @returns Its game, card owner and state, or null when the cell does not exist.
 */
export async function getCellReactionTarget(cellId: string): Promise<CellReactionTarget | null> {
  const rows = await query<Array<{ game_id: string; user_id: string; state: CellState }>>(
    `SELECT bc.game_id, bc.user_id, c.state
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE c.id = ?`,
    [cellId]
  );
  return rows.length > 0
    ? { gameId: rows[0].game_id, cardUserId: rows[0].user_id, state: rows[0].state }
    : null;
}

/**
 * Add a player's reaction to a stamped cell at a random spot, or change the emoji of their
 * existing reaction and keep its spot. The insert is guarded by the cell's state, so a cell
 * that stopped being stamped meanwhile gets no reaction. The route checks permissions.
 * Spec: 24-cell-reactions.md - Adding, Changing and Removing
 *
 * @param cellId - The cell.
 * @param userId - The reacting player.
 * @param reaction - The reaction from the pool.
 * @returns The stored reaction, or null when the cell is no longer stamped.
 */
export async function setCellReaction(
  cellId: string,
  userId: string,
  reaction: ReactionId
): Promise<CellReaction | null> {
  await execute(
    `INSERT INTO cell_reactions (cell_id, user_id, reaction, pos_x, pos_y)
     SELECT c.id, ?, ?, ?, ?
     FROM bingo_cells c
     WHERE c.id = ? AND c.state IN (${STAMPED_STATES_SQL})
     ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)`,
    [userId, reaction, randomSpot(), randomSpot(), cellId]
  );

  // Read back rather than trust affectedRows, which is 0 when the same reaction is sent again
  const rows = await query<CellReactionRow[]>(
    `SELECT r.cell_id, r.user_id, r.reaction, r.pos_x, r.pos_y
     FROM cell_reactions r
     JOIN bingo_cells c ON c.id = r.cell_id
     WHERE r.cell_id = ? AND r.user_id = ? AND c.state IN (${STAMPED_STATES_SQL})`,
    [cellId, userId]
  );
  return rows.length > 0 ? rowToReaction(rows[0]) : null;
}

/**
 * Remove a player's reaction from a cell. The route checks permissions.
 * Spec: 24-cell-reactions.md - Adding, Changing and Removing
 *
 * @param cellId - The cell.
 * @param userId - The player whose reaction is removed.
 * @returns True when a reaction was removed, false when there was none.
 */
export async function removeCellReaction(cellId: string, userId: string): Promise<boolean> {
  const result = await execute(
    `DELETE FROM cell_reactions WHERE cell_id = ? AND user_id = ?`,
    [cellId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Delete every reaction of a cell that is no longer stamped. Called after each write that can
 * move a cell out of `completed` or `accomplished`; it leaves a stamped cell's reactions alone.
 * Spec: 24-cell-reactions.md - Clearing
 *
 * @param cellId - The cell whose state may have changed.
 * @param connection - The transaction of the state change, when there is one.
 */
export async function clearUnstampedCellReactions(
  cellId: string,
  connection?: PoolConnection
): Promise<void> {
  await execute(
    `DELETE r FROM cell_reactions r
     JOIN bingo_cells c ON c.id = r.cell_id
     WHERE r.cell_id = ? AND c.state NOT IN (${STAMPED_STATES_SQL})`,
    [cellId],
    connection
  );
}
