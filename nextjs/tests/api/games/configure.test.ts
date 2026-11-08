/**
 * Route tests for configuring a game's deadline.
 * Spec Reference: 16-games.md - Game Configuration
 */

import { describe, expect, it } from 'vitest';
import { PATCH as configure } from '@/app/api/games/[gameId]/route';
import { GameStatus } from '@/lib/shared/types';
import { execute, query } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createGameSetup } from './helpers';

/**
 * Read a game's deadline as text.
 * @param gameId The game
 * @returns YYYY-MM-DD, or null without a deadline
 */
const readDeadline = async (gameId: string): Promise<string | null> => {
  const rows = await query<{ deadline: string | null }[]>('SELECT CAST(deadline AS CHAR) AS deadline FROM games WHERE id = ?', [gameId]);
  return rows[0].deadline;
};

/**
 * A date relative to today on the database clock.
 * @param days Days from today (negative is past)
 * @returns The date as YYYY-MM-DD
 */
const dbDate = async (days: number): Promise<string> => {
  const rows = await query<{ day: string }[]>('SELECT CAST(CURDATE() + INTERVAL ? DAY AS CHAR) AS day', [days]);
  return rows[0].day;
};

describe('games – configure', () => {
  describe('operations', () => {
    it('accepts today as the deadline, the last playable day (16-games.md – Game Configuration)', async () => {
      // Arrange
      const { admin, game } = await createGameSetup();
      await signInAs(admin);
      const today = await dbDate(0);

      // Act
      const result = await callRoute(configure, { method: 'PATCH', body: { deadline: today }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(await readDeadline(game.id)).toBe(today);
    });
  });

  describe('rejects', () => {
    it.each(['2026-02-31', '31/12/2026', 'tomorrow', 20261231])(
      'a deadline of %s, which is not a real date, with 400 (16-games.md – Game Configuration)',
      async (deadline) => {
        // Arrange
        const { admin, game } = await createGameSetup();
        await signInAs(admin);

        // Act
        const result = await callRoute(configure, { method: 'PATCH', body: { deadline }, params: { gameId: game.id } });

        // Assert
        expect(result.status).toBe(400);
        expect(await readDeadline(game.id)).toBeNull();
      }
    );

    it('a deadline before today, with 400 (16-games.md – Game Configuration)', async () => {
      // Arrange
      const { admin, game } = await createGameSetup();
      await signInAs(admin);

      // Act
      const result = await callRoute(configure, { method: 'PATCH', body: { deadline: await dbDate(-1) }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await readDeadline(game.id)).toBeNull();
    });

    it('a deadline before the date of the preparation deadline, with 400 (16-games.md – Game Configuration)', async () => {
      // Arrange
      const { admin, game } = await createGameSetup(GameStatus.FORMING);
      await execute('UPDATE games SET preparation_deadline = UTC_TIMESTAMP() + INTERVAL 3 DAY WHERE id = ?', [game.id]);
      await signInAs(admin);

      // Act
      const result = await callRoute(configure, { method: 'PATCH', body: { deadline: await dbDate(1) }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await readDeadline(game.id)).toBeNull();
    });

    it('a player who is not an admin, with 403 (16-games.md – Game Configuration)', async () => {
      // Arrange
      const { player, game } = await createGameSetup();
      await signInAs(player);

      // Act
      const result = await callRoute(configure, { method: 'PATCH', body: { deadline: await dbDate(5) }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(403);
      expect(await readDeadline(game.id)).toBeNull();
    });
  });
});
