/**
 * DB tests for team members joining running games.
 * Spec Reference: 16-games.md - Joining After Start
 */

import { describe, expect, it } from 'vitest';
import { addPlayerToRunningGames } from '@/lib/db/game-repository';
import { GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
  type GameFixture,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';

describe('games – joining after start', () => {
  describe('operations', () => {
    it('adds a new team member to every running game, not to ended ones (16-games.md – Joining After Start)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const forming = await seedGame(team, [leader], GameStatus.FORMING);
      const started = await seedGame(team, [leader], GameStatus.STARTED);
      const ended = await seedGame(team, [leader], GameStatus.ENDED);
      const joiner = await createUser();
      await addMember(team, joiner);

      // Act
      await addPlayerToRunningGames(team.id, joiner.id);

      // Assert
      const playerOf = async (game: GameFixture): Promise<number> =>
        countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, joiner.id]);
      expect(await playerOf(forming)).toBe(1);
      expect(await playerOf(started)).toBe(1);
      expect(await playerOf(ended)).toBe(0);
    });
  });
});
