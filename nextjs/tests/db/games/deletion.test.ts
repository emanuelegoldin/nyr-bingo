/**
 * DB tests for deleting a game.
 * Spec Reference: 16-games.md - Deleting a Game
 */

import { describe, expect, it } from 'vitest';
import { deleteGame } from '@/lib/db/game-repository';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createMemberResolution,
  createTeam as seedTeam,
  createTeamGoal,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';

describe('games – deletion', () => {
  describe('operations', () => {
    it('deletes a game with its roster, goal, resolutions and cards, leaving the team and sibling games (16-games.md – Deleting a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member]);
      await createTeamGoal(game, leader);
      await createMemberResolution(game, leader, member);
      await createCard(game, leader, [{}]);
      const sibling = await seedGame(team, [leader]);

      // Act
      await deleteGame(game.id);

      // Assert
      expect(await countRows('games', 'id = ?', [game.id])).toBe(0);
      expect(await countRows('game_players', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('teams', 'id = ?', [team.id])).toBe(1);
      expect(await countRows('games', 'id = ?', [sibling.id])).toBe(1);
    });
  });
});
