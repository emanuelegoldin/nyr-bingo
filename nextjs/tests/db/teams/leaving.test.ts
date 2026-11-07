/**
 * DB tests for leaving a team.
 * Spec Reference: 04-bingo-teams.md - Leaving a Team
 */

import { describe, expect, it } from 'vitest';
import { leaveTeam } from '@/lib/db/leave-repository';
import { GameStatus, TeamRole } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { readRole } from './helpers';

describe('teams – leaving', () => {
  describe('operations', () => {
    it('removes a leaving member from the team and from its running games (04-bingo-teams.md – Leaving a Team)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member]);
      await createCard(game, member, [{}]);

      // Act
      const result = await leaveTeam(team.id, member.id, false);

      // Assert
      expect(result.success).toBe(true);
      expect(await readRole(team.id, member.id)).toBeUndefined();
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
    });
  });

  describe('rejects', () => {
    it('the only Team Admin leaving the team (04-bingo-teams.md – Leaving a Team)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);

      // Act
      const result = await leaveTeam(team.id, leader.id, true);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await readRole(team.id, leader.id)).toBe(TeamRole.LEADER);
    });

    it('an admin leaving while they are the only admin playing a running game (04-bingo-teams.md – Leaving a Team)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const otherAdmin = await createUser();
      await addMember(team, otherAdmin, TeamRole.LEADER);
      const game = await seedGame(team, [leader], GameStatus.FORMING);

      // Act
      const result = await leaveTeam(team.id, leader.id, true);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await readRole(team.id, leader.id)).toBe(TeamRole.LEADER);
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, leader.id])).toBe(1);
    });
  });
});
