/**
 * Route tests for inviting a team member to a game.
 * Spec Reference: 16-games.md - Inviting a Player; 19-notifications.md - Events; 21-authorization.md - Permission Table
 */

import { describe, expect, it } from 'vitest';
import { POST as leave } from '@/app/api/games/[gameId]/leave/route';
import { POST as invite } from '@/app/api/games/[gameId]/players/route';
import { GameStatus } from '@/lib/shared/types';
import { addMember, createTeamGoal, createUser, type UserFixture } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';
import { createGameSetup, type GameSetup } from './helpers';

/**
 * Build a game of an admin and a player, with a third team member who does not play it.
 * @param status The game's status
 * @returns The game setup and the member who is not a player
 */
const createSetupWithOutsider = async (status: GameStatus): Promise<GameSetup & { outsider: UserFixture }> => {
  const setup = await createGameSetup(status);
  const outsider = await createUser();
  await addMember(setup.team, outsider);
  return { ...setup, outsider };
};

/**
 * Whether a user plays a game.
 * @param gameId The game
 * @param userId The user
 * @returns The number of roster rows, 0 or 1
 */
const playerRows = (gameId: string, userId: string): Promise<number> =>
  countRows('game_players', 'game_id = ? AND user_id = ?', [gameId, userId]);

describe('games – invite a player', () => {
  describe('operations', () => {
    it('makes a team member a player of a game in preparation, not ready, with no card (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const { admin, outsider, game } = await createSetupWithOutsider(GameStatus.FORMING);
      await signInAs(admin);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: { userId: outsider.id }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('game_players', 'game_id = ? AND user_id = ? AND ready_at IS NULL', [game.id, outsider.id])).toBe(1);
      expect(await countRows('bingo_cards', 'game_id = ? AND user_id = ?', [game.id, outsider.id])).toBe(0);
    });

    it('gives the invited member a card in a started game (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const { admin, outsider, game } = await createSetupWithOutsider(GameStatus.STARTED);
      await createTeamGoal(game, admin);
      await signInAs(admin);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: { userId: outsider.id }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(await playerRows(game.id, outsider.id)).toBe(1);
      expect(await countRows('bingo_cards', 'game_id = ? AND user_id = ?', [game.id, outsider.id])).toBe(1);
    });

    it('notifies the invited member only (19-notifications.md – Events)', async () => {
      // Arrange
      const { admin, outsider, game } = await createSetupWithOutsider(GameStatus.FORMING);
      await signInAs(admin);

      // Act
      await callRoute(invite, { method: 'POST', body: { userId: outsider.id }, params: { gameId: game.id } });

      // Assert
      expect(await countRows(
        'notification_events',
        "type = 'game_invited' AND game_id = ? AND actor_user_id = ? AND target_user_id = ?",
        [game.id, admin.id, outsider.id]
      )).toBe(1);
    });

    it('lets an admin invite back a player who left (16-games.md – Leaving a Game)', async () => {
      // Arrange
      const { admin, player, game } = await createGameSetup(GameStatus.FORMING);
      await signInAs(player);
      await callRoute(leave, { method: 'POST', params: { gameId: game.id } });
      await signInAs(admin);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: { userId: player.id }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(200);
      expect(await playerRows(game.id, player.id)).toBe(1);
    });
  });

  describe('rejects', () => {
    it('a player who is not an admin, with 403 (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { player, outsider, game } = await createSetupWithOutsider(GameStatus.FORMING);
      await signInAs(player);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: { userId: outsider.id }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(403);
      expect(await playerRows(game.id, outsider.id)).toBe(0);
    });

    it('a user who is not a member of the team, with 400 (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const { admin, game } = await createGameSetup(GameStatus.FORMING);
      const stranger = await createUser();
      await signInAs(admin);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: { userId: stranger.id }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await playerRows(game.id, stranger.id)).toBe(0);
    });

    it('a member who already plays the game, with 400 and no notification (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const { admin, player, game } = await createGameSetup(GameStatus.FORMING);
      await signInAs(admin);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: { userId: player.id }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('notification_events', "type = 'game_invited' AND game_id = ?", [game.id])).toBe(0);
    });

    it('a missing userId, with 400 (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const { admin, game } = await createGameSetup(GameStatus.FORMING);
      await signInAs(admin);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: {}, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(400);
    });

    it('an ended game, with 404 (16-games.md – Listing and Reading Games)', async () => {
      // Arrange
      const { admin, outsider, game } = await createSetupWithOutsider(GameStatus.ENDED);
      await signInAs(admin);

      // Act
      const result = await callRoute(invite, { method: 'POST', body: { userId: outsider.id }, params: { gameId: game.id } });

      // Assert
      expect(result.status).toBe(404);
      expect(await playerRows(game.id, outsider.id)).toBe(0);
    });
  });
});
