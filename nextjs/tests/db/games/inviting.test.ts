/**
 * DB tests for inviting a team member to a game.
 * Spec Reference: 16-games.md - Inviting a Player
 */

import { describe, expect, it } from 'vitest';
import { addPlayerToGame } from '@/lib/db/game-repository';
import { GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';

describe('games – inviting a player', () => {
  describe('operations', () => {
    it('adds the member to a forming or started game, not ready (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const forming = await seedGame(team, [leader], GameStatus.FORMING);
      const started = await seedGame(team, [leader], GameStatus.STARTED);
      const member = await createUser();
      await addMember(team, member);

      // Act
      const addedToForming = await addPlayerToGame(forming.id, member.id);
      const addedToStarted = await addPlayerToGame(started.id, member.id);

      // Assert
      expect(addedToForming).toBe(true);
      expect(addedToStarted).toBe(true);
      expect(await countRows('game_players', 'game_id = ? AND user_id = ? AND ready_at IS NULL', [forming.id, member.id])).toBe(1);
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [started.id, member.id])).toBe(1);
    });

    it('adds the member to that game only (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const invitedTo = await seedGame(team, [leader], GameStatus.FORMING);
      const sibling = await seedGame(team, [leader], GameStatus.FORMING);
      const member = await createUser();
      await addMember(team, member);

      // Act
      await addPlayerToGame(invitedTo.id, member.id);

      // Assert
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [sibling.id, member.id])).toBe(0);
    });
  });

  describe('rejects', () => {
    it('adding a player to an ended game (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const ended = await seedGame(team, [leader], GameStatus.ENDED);
      const member = await createUser();
      await addMember(team, member);

      // Act
      const added = await addPlayerToGame(ended.id, member.id);

      // Assert
      expect(added).toBe(false);
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [ended.id, member.id])).toBe(0);
    });

    it('adding someone who already plays the game (16-games.md – Inviting a Player)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const game = await seedGame(team, [leader], GameStatus.FORMING);

      // Act
      const added = await addPlayerToGame(game.id, leader.id);

      // Assert
      expect(added).toBe(false);
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, leader.id])).toBe(1);
    });
  });
});
