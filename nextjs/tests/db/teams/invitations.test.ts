/**
 * DB tests for team invitations and joining with an invite code.
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */

import { describe, expect, it } from 'vitest';
import { createTeamInvitation, joinTeamByInviteCode } from '@/lib/db/team-repository';
import { InvitationStatus, TeamRole } from '@/lib/shared/types';
import { createInvitation, createTeam as seedTeam, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import { readRole } from './helpers';

describe('teams – invitations', () => {
  describe('operations', () => {
    it('stores a pending invitation that expires after 7 days (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);

      // Act
      const invitation = await createTeamInvitation(team.id, 'friend@test.local');

      // Assert
      const rows = await query<{ status: InvitationStatus; invited_email: string; days_left: number }[]>(
        `SELECT status, invited_email, ROUND(TIMESTAMPDIFF(HOUR, NOW(), expires_at) / 24) AS days_left
           FROM team_invitations WHERE invite_code = ?`,
        [invitation.inviteCode]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe(InvitationStatus.PENDING);
      expect(rows[0].invited_email).toBe('friend@test.local');
      expect(Number(rows[0].days_left)).toBe(7);
    });

    it('joins a user as member and marks the invitation accepted (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const inviteCode = await createInvitation(team);
      const joiner = await createUser();

      // Act
      const result = await joinTeamByInviteCode(inviteCode, joiner.id);

      // Assert
      expect(result.success).toBe(true);
      expect(await readRole(team.id, joiner.id)).toBe(TeamRole.MEMBER);
      const invitations = await query<{ status: InvitationStatus; invited_user_id: string }[]>(
        'SELECT status, invited_user_id FROM team_invitations WHERE invite_code = ?',
        [inviteCode]
      );
      expect(invitations[0]).toEqual({ status: InvitationStatus.ACCEPTED, invited_user_id: joiner.id });
    });
  });

  describe('rejects', () => {
    it('joining with an invitation that was already used (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const inviteCode = await createInvitation(team, { status: InvitationStatus.ACCEPTED });
      const joiner = await createUser();

      // Act
      const result = await joinTeamByInviteCode(inviteCode, joiner.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Invalid or expired invitation' });
      expect(await readRole(team.id, joiner.id)).toBeUndefined();
    });

    it('joining with an expired invitation (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const inviteCode = await createInvitation(team, { expired: true });
      const joiner = await createUser();

      // Act
      const result = await joinTeamByInviteCode(inviteCode, joiner.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Invalid or expired invitation' });
      expect(await readRole(team.id, joiner.id)).toBeUndefined();
    });

    it('joining a team the user is already a member of (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const inviteCode = await createInvitation(team);

      // Act
      const result = await joinTeamByInviteCode(inviteCode, leader.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Already a member of this team' });
      expect(await readRole(team.id, leader.id)).toBe(TeamRole.LEADER);
      expect(await countRows('team_invitations', "invite_code = ? AND status = 'pending'", [inviteCode])).toBe(1);
    });
  });
});
