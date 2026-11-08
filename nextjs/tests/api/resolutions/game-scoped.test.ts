/**
 * Route tests for saving the team goal, member-provided and personal resolutions of a game.
 * Spec Reference: 16-games.md - Team Goal, Member-Provided Resolutions; 03-personal-resolutions.md - Permissions
 */

import { describe, expect, it } from 'vitest';
import { POST as save } from '@/app/api/resolutions/save/route';
import { GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createGame,
  createMemberResolution,
  createPersonalResolution,
  createTeam,
  createTeamGoal,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

/**
 * Build a game of an admin and two players, with a benched team member.
 * @param status The game's status (default forming)
 * @returns The users and the game
 */
const createProposalGame = async (status: GameStatus = GameStatus.FORMING) => {
  const [admin, alice, bob, benched] = [await createUser(), await createUser(), await createUser(), await createUser()];
  const team = await createTeam(admin);
  for (const member of [alice, bob, benched]) {
    await addMember(team, member);
  }
  const game = await createGame(team, [admin, alice, bob], status);
  return { admin, alice, bob, benched, game };
};

describe('resolutions – game scoped', () => {
  describe('operations', () => {
    it('lets the admin set the team goal (16-games.md – Team Goal)', async () => {
      // Arrange
      const { admin, game } = await createProposalGame();
      await signInAs(admin);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { scope: 'team', gameId: game.id, type: 'base', title: 'Run together' } });

      // Assert
      expect(result.status).toBe(201);
      expect(await countRows('resolutions', "game_id = ? AND scope = 'team'", [game.id])).toBe(1);
    });

    it('updates the existing goal when the admin saves a new one, keeping one per game (16-games.md – Team Goal)', async () => {
      // Arrange
      const { admin, game } = await createProposalGame();
      await createTeamGoal(game, admin);
      await signInAs(admin);

      // Act
      await callRoute(save, { method: 'POST', body: { scope: 'team', gameId: game.id, type: 'base', title: 'New goal' } });

      // Assert
      expect(await countRows('resolutions', "game_id = ? AND scope = 'team'", [game.id])).toBe(1);
      expect(await countRows('resolutions', "game_id = ? AND scope = 'team' AND title = 'New goal'", [game.id])).toBe(1);
    });

    it('overwrites the author\'s earlier proposal to the same player (16-games.md – Member-Provided Resolutions)', async () => {
      // Arrange
      const { alice, bob, game } = await createProposalGame();
      await createMemberResolution(game, alice, bob, { title: 'First idea' });
      await signInAs(alice);

      // Act
      await callRoute(save, {
        method: 'POST',
        body: { scope: 'member_provided', gameId: game.id, toUserId: bob.id, type: 'base', title: 'Better idea' },
      });

      // Assert
      expect(await countRows('resolutions', "game_id = ? AND owner_user_id = ? AND to_user_id = ?", [game.id, alice.id, bob.id])).toBe(1);
      expect(await countRows('resolutions', "game_id = ? AND title = 'Better idea'", [game.id])).toBe(1);
    });

    it('creates a personal resolution for the game, during the preparation phase (03-personal-resolutions.md – Create and Update)', async () => {
      // Arrange
      const { alice, game } = await createProposalGame();
      await signInAs(alice);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { gameId: game.id, type: 'base', title: 'Learn chess' } });

      // Assert
      expect(result.status).toBe(201);
      expect(
        await countRows('resolutions', "owner_user_id = ? AND scope = 'personal' AND game_id = ? AND team_id = ?", [alice.id, game.id, game.teamId])
      ).toBe(1);
    });

    it('creates a personal resolution for a game that has already started (03-personal-resolutions.md – Create and Update)', async () => {
      // Arrange
      const { alice, game } = await createProposalGame(GameStatus.STARTED);
      await signInAs(alice);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { scope: 'personal', gameId: game.id, type: 'base', title: 'Learn chess' } });

      // Assert
      expect(result.status).toBe(201);
      expect(await countRows('resolutions', "owner_user_id = ? AND scope = 'personal' AND game_id = ?", [alice.id, game.id])).toBe(1);
    });
  });

  describe('rejects', () => {
    it('a player who is not an admin setting the goal, with 403 (16-games.md – Team Goal)', async () => {
      // Arrange
      const { alice, game } = await createProposalGame();
      await signInAs(alice);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { scope: 'team', gameId: game.id, type: 'base', title: 'My goal' } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
    });

    it('a player proposing a resolution to themselves, with 400 (16-games.md – Member-Provided Resolutions)', async () => {
      // Arrange
      const { alice, game } = await createProposalGame();
      await signInAs(alice);

      // Act
      const result = await callRoute(save, {
        method: 'POST',
        body: { scope: 'member_provided', gameId: game.id, toUserId: alice.id, type: 'base', title: 'For me' },
      });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
    });

    it('proposing to a team member who does not play the game, with 400 (16-games.md – Member-Provided Resolutions)', async () => {
      // Arrange
      const { alice, benched, game } = await createProposalGame();
      await signInAs(alice);

      // Act
      const result = await callRoute(save, {
        method: 'POST',
        body: { scope: 'member_provided', gameId: game.id, toUserId: benched.id, type: 'base', title: 'For you' },
      });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
    });

    it('a team member who does not play the game proposing, with 403 (16-games.md – Member-Provided Resolutions)', async () => {
      // Arrange
      const { alice, benched, game } = await createProposalGame();
      await signInAs(benched);

      // Act
      const result = await callRoute(save, {
        method: 'POST',
        body: { scope: 'member_provided', gameId: game.id, toUserId: alice.id, type: 'base', title: 'For you' },
      });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
    });

    it('editing a proposal of an ended game (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const { alice, bob, game } = await createProposalGame(GameStatus.ENDED);
      const id = await createMemberResolution(game, alice, bob, { title: 'Frozen' });
      await signInAs(alice);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { id, type: 'base', title: 'Changed later' } });

      // Assert
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(await countRows('resolutions', "id = ? AND title = 'Frozen'", [id])).toBe(1);
    });

    it('a personal resolution without a game, with 400 (03-personal-resolutions.md – Create and Update)', async () => {
      // Arrange
      const { alice } = await createProposalGame();
      await signInAs(alice);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { type: 'base', title: 'Learn chess' } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', 'owner_user_id = ?', [alice.id])).toBe(0);
    });

    it('a personal resolution for a game the caller does not play, with 403 (03-personal-resolutions.md – Permissions)', async () => {
      // Arrange
      const { benched, game } = await createProposalGame();
      await signInAs(benched);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { gameId: game.id, type: 'base', title: 'Learn chess' } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('resolutions', 'owner_user_id = ?', [benched.id])).toBe(0);
    });

    it('updating a legacy personal resolution, with 400 (03-personal-resolutions.md – Legacy Personal Resolutions)', async () => {
      // Arrange
      const { alice, game } = await createProposalGame();
      const legacyId = await createPersonalResolution(alice, 'From the old list');
      await signInAs(alice);

      // Act
      const result = await callRoute(save, { method: 'POST', body: { id: legacyId, gameId: game.id, type: 'base', title: 'Changed' } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('resolutions', "id = ? AND title = 'From the old list'", [legacyId])).toBe(1);
    });
  });
});
