/**
 * DB tests for the conditions that allow a game to start.
 * Spec Reference: 16-games.md - Start Conditions
 */

import { describe, expect, it } from 'vitest';
import { checkGameCanStart } from '@/lib/db/game-repository';
import { GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createGame as seedGame,
  createTeam as seedTeam,
  createTeamGoal,
  createUser,
} from '../../support/db/fixtures';
import { expireDeadline } from './helpers';

describe('games – start conditions', () => {
  describe('operations', () => {
    it('allows the start once the goal is set, with member resolutions missing (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member], GameStatus.FORMING);
      await createTeamGoal(game, leader);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: true });
    });
  });

  describe('rejects', () => {
    it('starting without a team goal (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.FORMING);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Team resolution must be set before starting' });
    });

    it('starting after the deadline is over (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.FORMING);
      await createTeamGoal(game, leader);
      await expireDeadline(game);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'The game deadline has passed' });
    });

    it('starting a game that is not forming (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.STARTED);
      await createTeamGoal(game, leader);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Game is not in forming status' });
    });
  });
});
