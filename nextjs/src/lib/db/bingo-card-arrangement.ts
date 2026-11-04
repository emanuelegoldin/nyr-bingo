/**
 * Bingo Card Arrangement - Shuffling and locking a card
 * Spec Reference: 22-card-shuffle.md
 */

import type { PoolConnection } from 'mysql2/promise';
import { CellState, DONE_CELL_STATES } from '../shared/types';
import { shuffleArray } from '../shared/shuffle';
import { execute, query, withTransaction } from './connection';

/** Outcome of a shuffle or a lock: success, or the error and its HTTP status. */
export type CardArrangementResult =
  | { success: true }
  | { success: false; status: 400 | 404; error: string };

/** Offset that moves every cell out of the grid's positions, so the unique (card, position) key holds while they are reassigned. */
const PARKING_OFFSET = 1000;

const NO_CARD: CardArrangementResult = { success: false, status: 404, error: 'You have no card in this game' };

/**
 * Lock a user's card row in a game that has not ended, for the rest of the transaction.
 * @param connection The transaction
 * @param gameId The game
 * @param userId The card owner
 * @returns The card's id and lock time, or null when the user has no card in a running game
 */
async function lockCardRow(
  connection: PoolConnection,
  gameId: string,
  userId: string
): Promise<{ id: string; locked_at: Date | null } | null> {
  const rows = await query<Array<{ id: string; locked_at: Date | null }>>(
    `SELECT bc.id, bc.locked_at
     FROM bingo_cards bc
     JOIN games g ON g.id = bc.game_id
     WHERE bc.game_id = ? AND bc.user_id = ? AND g.status <> 'ended'
     FOR UPDATE`,
    [gameId, userId],
    connection
  );
  return rows[0] ?? null;
}

/**
 * Give the stored cells of a user's card a new random arrangement. The Joker is not stored, so it
 * stays at the center. Cells keep their id, content, state and `updated_at`.
 * Spec: 22-card-shuffle.md - Shuffle
 * @param gameId The game
 * @param userId The card owner; the caller checks that they play the game
 * @returns Success, or why the card cannot be shuffled
 */
export async function shuffleBingoCard(gameId: string, userId: string): Promise<CardArrangementResult> {
  return withTransaction(async (connection): Promise<CardArrangementResult> => {
    const card = await lockCardRow(connection, gameId, userId);
    if (!card) return NO_CARD;
    if (card.locked_at) {
      return { success: false, status: 400, error: 'This card is locked and can no longer be shuffled' };
    }

    // Locking the cells makes a concurrent completion wait for the shuffle, or the shuffle see it
    const cells = await query<Array<{ id: string; position: number; state: CellState }>>(
      `SELECT id, position, state FROM bingo_cells WHERE card_id = ? FOR UPDATE`,
      [card.id],
      connection
    );
    // A done cell must not be moved into a bingo line
    if (cells.some((cell) => DONE_CELL_STATES.includes(cell.state))) {
      return { success: false, status: 400, error: 'A card with completed cells can no longer be shuffled' };
    }

    const positions = cells.map((cell) => cell.position);
    shuffleArray(positions);

    await execute(
      `UPDATE bingo_cells SET position = position + ?, updated_at = updated_at WHERE card_id = ?`,
      [PARKING_OFFSET, card.id],
      connection
    );
    for (const [index, cell] of cells.entries()) {
      await execute(
        `UPDATE bingo_cells SET position = ?, updated_at = updated_at WHERE id = ?`,
        [positions[index], cell.id],
        connection
      );
    }

    return { success: true };
  });
}

/**
 * Lock a user's card so it can no longer be shuffled. Locking a locked card keeps its first lock time.
 * Spec: 22-card-shuffle.md - Lock
 * @param gameId The game
 * @param userId The card owner; the caller checks that they play the game
 * @returns Success, or the error when the user has no card
 */
export async function lockBingoCard(gameId: string, userId: string): Promise<CardArrangementResult> {
  return withTransaction(async (connection): Promise<CardArrangementResult> => {
    const card = await lockCardRow(connection, gameId, userId);
    if (!card) return NO_CARD;

    if (!card.locked_at) {
      await execute(`UPDATE bingo_cards SET locked_at = NOW() WHERE id = ?`, [card.id], connection);
    }
    return { success: true };
  });
}
