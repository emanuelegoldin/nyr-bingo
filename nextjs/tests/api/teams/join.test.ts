/**
 * Route tests for joining a team through an invitation.
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining; 16-games.md - Inviting a Player
 */

import { describe, expect, it } from 'vitest';
import { POST as joinTeam } from '@/app/api/join/route';
import { GameStatus } from '@/lib/shared/types';
import {
  createGame,
  createInvitation,
  createTeam,
  createTeamGoal,
  createUser,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

describe('teams – join', () => {
  describe('operations', () => {
    it('makes the new member a player of no game and gives them no card (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Arrange
      const admin = await createUser();
      const team = await createTeam(admin);
      await createGame(team, [admin], GameStatus.FORMING);
      const started = await createGame(team, [admin], GameStatus.STARTED);
      await createTeamGoal(started, admin);
      const inviteCode = await createInvitation(team);
      const joiner = await createUser();
      await signInAs(joiner);

      // Act
      const result = await callRoute(joinTeam, { method: 'POST', body: { inviteCode } });

      // Assert
      expect(result.status).toBe(200);
      expect(await countRows('team_memberships', 'team_id = ? AND user_id = ?', [team.id, joiner.id])).toBe(1);
      expect(await countRows('game_players', 'user_id = ?', [joiner.id])).toBe(0);
      expect(await countRows('bingo_cards', 'user_id = ?', [joiner.id])).toBe(0);
    });
  });
});
