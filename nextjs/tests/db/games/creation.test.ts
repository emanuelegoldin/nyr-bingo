/**
 * DB tests for creating a game.
 * Spec Reference: 16-games.md - Game Creation
 */

import { describe, expect, it } from 'vitest';
import { createGame } from '@/lib/db/game-repository';
import { GameStatus } from '@/lib/shared/types';
import { addMember, createTeam as seedTeam, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { readGame } from './helpers';

describe('games – creation', () => {
  describe('operations', () => {
    it('creates a forming game with its grid size and each player once (16-games.md – Game Creation)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);

      // Act
      const game = await createGame(team.id, 'Spring', [leader.id, member.id, leader.id], 3);

      // Assert
      const stored = await readGame(game.id);
      expect(stored).toMatchObject({ status: GameStatus.FORMING, grid_size: 3, deadline: null, started_at: null });
      expect(await countRows('game_players', 'game_id = ?', [game.id])).toBe(2);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
    });
  });
});
