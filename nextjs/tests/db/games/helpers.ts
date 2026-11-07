/**
 * Helpers shared by the games DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { it } from 'vitest';
import { GameStatus } from '@/lib/shared/types';
import { type GameFixture } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

/** The persisted fields of a game that the tests look at. */
export interface StoredGame {
  status: GameStatus;
  deadline: string | null;
  grid_size: number;
  started_at: Date | null;
  ended_at: Date | null;
}

/**
 * Read a game straight from the table, bypassing the repository.
 * @param gameId The game
 * @returns The stored fields, with the deadline as YYYY-MM-DD text
 */
export const readGame = async (gameId: string): Promise<StoredGame> => {
  const rows = await query<StoredGame[]>(
    'SELECT status, CAST(deadline AS CHAR) AS deadline, grid_size, started_at, ended_at FROM games WHERE id = ?',
    [gameId]
  );
  return rows[0];
};

/**
 * Set a game's deadline to yesterday on the database clock, so it is over.
 * @param game The game
 */
export const expireDeadline = async (game: GameFixture): Promise<void> => {
  await execute('UPDATE games SET deadline = CURDATE() - INTERVAL 1 DAY WHERE id = ?', [game.id]);
};
