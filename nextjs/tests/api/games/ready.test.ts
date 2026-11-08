/**
 * Route tests for marking oneself ready in the preparation phase, and the automatic start it triggers.
 * Spec Reference: 16-games.md - Ready, Automatic Start, Leaving a Game; 21-authorization.md - Permission Table
 */

import { describe, expect, it } from 'vitest';
import { POST as leave } from '@/app/api/games/[gameId]/leave/route';
import { POST as ready } from '@/app/api/games/[gameId]/ready/route';
import { GameStatus } from '@/lib/shared/types';
import { addMember, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute, query } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createGameSetup } from './helpers';

/**
 * Read a game's status.
 * @param gameId The game
 * @returns The stored status
 */
const readStatus = async (gameId: string): Promise<string> => {
  const rows = await query<{ status: string }[]>('SELECT status FROM games WHERE id = ?', [gameId]);
  return rows[0].status;
};

/**
 * Mark a player ready directly in the table.
 * @param gameId The game
 * @param userId The player
 */
const markReady = async (gameId: string, userId: string): Promise<void> => {
  await execute('UPDATE game_players SET ready_at = UTC_TIMESTAMP() WHERE game_id = ? AND user_id = ?', [gameId, userId]);
};

describe('games – ready', () => {
  describe('operations', () => {
    it('marks the caller ready while others are not, keeping the game in preparation (16-games.md – Ready)', async () => {
      // Arrange
      const { player, game } = await createGameSetup(GameStatus.FORMING);
      await signInAs(player);

      // Act
      const result = await callRoute(ready, { method: 'POST', body: { ready: true }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ ready: true, started: false });
      expect(await countRows('game_players', 'game_id = ? AND user_id = ? AND ready_at IS NOT NULL', [game.id, player.id])).toBe(1);
      expect(await readStatus(game.id)).toBe(GameStatus.FORMING);
    });

    it('lets the caller become not ready again (16-games.md – Ready)', async () => {
      // Arrange
      const { player, game } = await createGameSetup(GameStatus.FORMING);
      await markReady(game.id, player.id);
      await signInAs(player);

      // Act
      const result = await callRoute(ready, { method: 'POST', body: { ready: false }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('game_players', 'game_id = ? AND ready_at IS NOT NULL', [game.id])).toBe(0);
    });

    it('starts the game when the last player becomes ready, even without a goal (16-games.md – Automatic Start)', async () => {
      // Arrange
      const { admin, player, game } = await createGameSetup(GameStatus.FORMING);
      await markReady(game.id, admin.id);
      await signInAs(player);

      // Act
      const result = await callRoute(ready, { method: 'POST', body: { ready: true }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ ready: true, started: true });
      expect(await readStatus(game.id)).toBe(GameStatus.STARTED);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(2);
      expect(await countRows('resolutions', "game_id = ? AND scope = 'team'", [game.id])).toBe(1);
    });

    it('starts the game when the last player who was not ready leaves (16-games.md – Leaving a Game)', async () => {
      // Arrange
      const { admin, player, game } = await createGameSetup(GameStatus.FORMING);
      await markReady(game.id, admin.id);
      await signInAs(player);

      // Act
      const result = await callRoute(leave, { method: 'POST', params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(await readStatus(game.id)).toBe(GameStatus.STARTED);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(1);
    });
  });

  describe('rejects', () => {
    it.each([undefined, 'yes', 1])('a ready value of %s, with 400 (16-games.md – Ready)', async (value) => {
      // Arrange
      const { player, game } = await createGameSetup(GameStatus.FORMING);
      await signInAs(player);

      // Act
      const result = await callRoute(ready, { method: 'POST', body: { ready: value }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('game_players', 'game_id = ? AND ready_at IS NOT NULL', [game.id])).toBe(0);
    });

    it('a game that has already started, with 400 (16-games.md – Ready)', async () => {
      // Arrange
      const { player, game } = await createGameSetup(GameStatus.STARTED);
      await signInAs(player);

      // Act
      const result = await callRoute(ready, { method: 'POST', body: { ready: true }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('game_players', 'game_id = ? AND ready_at IS NOT NULL', [game.id])).toBe(0);
    });

    it('a team member who does not play the game, with 403 (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { team, game } = await createGameSetup(GameStatus.FORMING);
      const benched = await createUser();
      await addMember(team, benched);
      await signInAs(benched);

      // Act
      const result = await callRoute(ready, { method: 'POST', body: { ready: true }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(403);
    });
  });
});
