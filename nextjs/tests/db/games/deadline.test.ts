/**
 * DB tests for setting a game deadline.
 * Spec Reference: 16-games.md - Game Configuration
 */

import { describe, expect, it } from 'vitest';
import { setGameDeadline } from '@/lib/db/game-repository';
import { GameStatus } from '@/lib/shared/types';
import { createGame as seedGame, createTeam as seedTeam, createUser } from '../../support/db/fixtures';
import { readGame } from './helpers';

describe('games – deadline', () => {
  describe('operations', () => {
    it('sets, changes and removes the deadline of a started game (16-games.md – Game Configuration)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader]);
      await setGameDeadline(game.id, '2099-01-31');

      // Act
      const changed = await setGameDeadline(game.id, '2099-12-31');
      const deadlineAfterChange = (await readGame(game.id)).deadline;
      const removed = await setGameDeadline(game.id, null);

      // Assert
      expect(changed).toBe(true);
      expect(deadlineAfterChange).toBe('2099-12-31');
      expect(removed).toBe(true);
      expect((await readGame(game.id)).deadline).toBeNull();
    });
  });

  describe('rejects', () => {
    it('setting the deadline of an ended game (16-games.md – Game Configuration)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.ENDED);

      // Act
      const changed = await setGameDeadline(game.id, '2099-12-31');

      // Assert
      expect(changed).toBe(false);
      expect((await readGame(game.id)).deadline).toBeNull();
    });
  });
});
