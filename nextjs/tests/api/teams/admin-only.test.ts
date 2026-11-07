/**
 * Route tests for the team actions only a Team Admin may take, and the status for a missing team.
 * Spec Reference: 21-authorization.md - Permission Table, Status Rules; 04-bingo-teams.md - Admins
 */

import { describe, expect, it } from 'vitest';
import { POST as invite } from '@/app/api/teams/[teamId]/invite/route';
import { POST as promote } from '@/app/api/teams/[teamId]/leaders/route';
import { POST as leaveTeam } from '@/app/api/teams/[teamId]/leave/route';
import { DELETE as deleteTeam } from '@/app/api/teams/[teamId]/route';
import { addMember, createTeam, createUser, type TeamFixture, type UserFixture } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

const MISSING_TEAM_ID = '00000000-0000-4000-8000-00000000dead';

/**
 * Build a team with an admin and two members, and log in the first member.
 * @returns The team, its admin and the members
 */
const signInAsMember = async (): Promise<{ team: TeamFixture; admin: UserFixture; member: UserFixture; other: UserFixture }> => {
  const [admin, member, other] = [await createUser(), await createUser(), await createUser()];
  const team = await createTeam(admin);
  await addMember(team, member);
  await addMember(team, other);
  await signInAs(member);
  return { team, admin, member, other };
};

describe('teams – admin only', () => {
  describe('rejects', () => {
    it('a member inviting, with 403 (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { team } = await signInAsMember();

      // Act
      const result = await callRoute(invite, { method: 'POST', body: {}, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('team_invitations', 'team_id = ?', [team.id])).toBe(0);
    });

    it('a member promoting another member, with 403 (04-bingo-teams.md – Admins)', async () => {
      // Arrange
      const { team, other } = await signInAsMember();

      // Act
      const result = await callRoute(promote, { method: 'POST', body: { userId: other.id }, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('team_memberships', "team_id = ? AND role = 'leader'", [team.id])).toBe(1);
    });

    it('a member deleting the team, with 403 (21-authorization.md – Permission Table)', async () => {
      // Arrange
      const { team } = await signInAsMember();

      // Act
      const result = await callRoute(deleteTeam, { method: 'DELETE', params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(403);
      expect(await countRows('teams', 'id = ?', [team.id])).toBe(1);
    });

    it.each([
      ['deleting', deleteTeam, 'DELETE'],
      ['promoting in', promote, 'POST'],
      ['leaving', leaveTeam, 'POST'],
    ] as const)('%s a missing team, with 404 (21-authorization.md – Status Rules)', async (_action, handler, method) => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(handler, { method, body: { userId: MISSING_TEAM_ID }, params: { teamId: MISSING_TEAM_ID } });

      // Assert
      expect(result.status).toBe(404);
    });

    it('inviting to a missing team, with 403 as for a non-member (21-authorization.md – Status Rules)', async () => {
      // Arrange
      await signInAs(await createUser());

      // Act
      const result = await callRoute(invite, { method: 'POST', body: {}, params: { teamId: MISSING_TEAM_ID } });

      // Assert
      expect(result.status).toBe(403);
    });
  });
});
