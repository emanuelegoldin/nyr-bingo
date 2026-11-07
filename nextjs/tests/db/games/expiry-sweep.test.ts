/**
 * DB tests for the sweep that ends and archives games whose deadline is over.
 * Spec Reference: 16-games.md - Ending a Game, Game Configuration
 */

import { describe, expect, it } from 'vitest';
import { finishExpiredGames } from '@/lib/game-ending';
import { GameStatus } from '@/lib/shared/types';
import { createGame, createTeam, createUser, type GameFixture } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute, query } from '../../support/db/test-connection';

/**
 * Create a game with one player and a deadline relative to today on the DB clock.
 * @param status The game's status
 * @param daysFromToday The deadline, in days from today (negative is past), or null for none
 * @returns The game
 */
const createGameWithDeadline = async (status: GameStatus, daysFromToday: number | null): Promise<GameFixture> => {
  const admin = await createUser();
  const game = await createGame(await createTeam(admin), [admin], status);
  if (daysFromToday !== null) {
    await execute('UPDATE games SET deadline = CURDATE() + INTERVAL ? DAY WHERE id = ?', [daysFromToday, game.id]);
  }
  return game;
};

/**
 * Read a game's status, or null once it is gone.
 * @param game The game
 * @returns The status
 */
const readStatus = async (game: GameFixture): Promise<string | null> => {
  const rows = await query<{ status: string }[]>('SELECT status FROM games WHERE id = ?', [game.id]);
  return rows[0]?.status ?? null;
};

describe('games – expiry sweep', () => {
  describe('operations', () => {
    it('ends and archives a started game whose last day has passed (16-games.md – Ending a Game)', async () => {
      // Arrange
      const game = await createGameWithDeadline(GameStatus.STARTED, -1);

      // Act
      await finishExpiredGames();

      // Assert
      expect(await readStatus(game)).toBeNull();
      expect(await countRows('archived_games', 'id = ?', [game.id])).toBe(1);
    });
  });

  describe('rejects', () => {
    it('ending a game on its last playable day (16-games.md – Game Configuration)', async () => {
      // Arrange
      const game = await createGameWithDeadline(GameStatus.STARTED, 0);

      // Act
      await finishExpiredGames();

      // Assert
      expect(await readStatus(game)).toBe(GameStatus.STARTED);
    });

    it('ending a forming game past its deadline (16-games.md – Ending a Game)', async () => {
      // Arrange
      const game = await createGameWithDeadline(GameStatus.FORMING, -1);

      // Act
      await finishExpiredGames();

      // Assert
      expect(await readStatus(game)).toBe(GameStatus.FORMING);
    });

    it('ending a game without a deadline (16-games.md – Game Configuration)', async () => {
      // Arrange
      const game = await createGameWithDeadline(GameStatus.STARTED, null);

      // Act
      await finishExpiredGames();

      // Assert
      expect(await readStatus(game)).toBe(GameStatus.STARTED);
    });
  });
});
