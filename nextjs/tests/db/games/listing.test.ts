/**
 * DB tests for listing the games a user plays.
 * Spec Reference: 16-games.md - Listing and Reading Games
 */

import { describe, expect, it } from 'vitest';
import { getRunningGamesForUser } from '@/lib/db/game-repository';
import { GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';

describe('games – listing', () => {
  describe('operations', () => {
    it('lists only the running games the user plays (16-games.md – Listing and Reading Games)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const played = await seedGame(team, [leader, member]);
      await seedGame(team, [leader, member], GameStatus.ENDED);
      await seedGame(team, [leader]);

      // Act
      const games = await getRunningGamesForUser(member.id);

      // Assert
      expect(games.map((game) => game.id)).toEqual([played.id]);
    });
  });
});
