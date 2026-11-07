/**
 * DB tests for ending a game.
 * Spec Reference: 16-games.md - Ending a Game
 */

import { describe, expect, it } from 'vitest';
import { endGame } from '@/lib/db/game-repository';
import { GameStatus } from '@/lib/shared/types';
import { createGame as seedGame, createTeam as seedTeam, createUser } from '../../support/db/fixtures';
import { readGame } from './helpers';

describe('games – ending', () => {
  describe('operations', () => {
    it('ends a started game and records when (16-games.md – Ending a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader]);

      // Act
      const ended = await endGame(game.id);

      // Assert
      expect(ended).toBe(true);
      const stored = await readGame(game.id);
      expect(stored.status).toBe(GameStatus.ENDED);
      expect(stored.ended_at).not.toBeNull();
    });
  });

  describe('rejects', () => {
    it('ending a game that has not started (16-games.md – Ending a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.FORMING);

      // Act
      const ended = await endGame(game.id);

      // Assert
      expect(ended).toBe(false);
      expect((await readGame(game.id)).status).toBe(GameStatus.FORMING);
    });
  });
});
