/**
 * DB tests for leaving a game.
 * Spec Reference: 16-games.md - Leaving a Game, Team Goal
 */

import { describe, expect, it } from 'vitest';
import { leaveGame } from '@/lib/db/leave-repository';
import { TeamRole } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createLeaderboardRow,
  createMemberResolution,
  createTeam as seedTeam,
  createTeamGoal,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';

describe('games – leaving', () => {
  describe('operations', () => {
    it('removes a leaving player with their card, leaderboard row and the resolutions written for them (16-games.md – Leaving a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member]);
      await createCard(game, member, [{}]);
      await createLeaderboardRow(game, member);
      const writtenForMember = await createMemberResolution(game, leader, member);
      const writtenByMember = await createMemberResolution(game, member, leader);

      // Act
      const result = await leaveGame({ id: game.id, name: 'Game' }, member.id, false);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
      expect(await countRows('team_leaderboard', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
      expect(await countRows('resolutions', 'id = ?', [writtenForMember])).toBe(0);
      expect(await countRows('resolutions', 'id = ?', [writtenByMember])).toBe(1);
      expect(await countRows('team_memberships', 'team_id = ? AND user_id = ?', [team.id, member.id])).toBe(1);
    });

    it('passes the team goal to another admin when its owner leaves (16-games.md – Team Goal)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const otherAdmin = await createUser();
      await addMember(team, otherAdmin, TeamRole.LEADER);
      const game = await seedGame(team, [leader, otherAdmin]);
      const goalId = await createTeamGoal(game, leader);

      // Act
      const result = await leaveGame({ id: game.id, name: 'Game' }, leader.id, true);

      // Assert
      expect(result).toEqual({ success: true });
      const goal = await query<{ owner_user_id: string }[]>('SELECT owner_user_id FROM resolutions WHERE id = ?', [goalId]);
      expect(goal[0].owner_user_id).toBe(otherAdmin.id);
    });
  });

  describe('rejects', () => {
    it('the only admin of a game leaving it (16-games.md – Leaving a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member]);

      // Act
      const result = await leaveGame({ id: game.id, name: 'Game' }, leader.id, true);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, leader.id])).toBe(1);
    });
  });
});
