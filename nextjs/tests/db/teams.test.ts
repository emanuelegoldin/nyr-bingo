/**
 * DB tests for teams: table structure, creation, invitations, joining, admins, deletion and leaving.
 * Spec Reference: 04-bingo-teams.md - Team Creation, Invitations / Joining, Admins, Team Deletion, Leaving a Team
 */

import { describe, expect, it } from 'vitest';
import { leaveTeam } from '@/lib/db/leave-repository';
import {
  createTeam,
  createTeamInvitation,
  deleteTeam,
  joinTeamByInviteCode,
  promoteToLeader,
} from '@/lib/db/team-repository';
import { GameStatus, InvitationStatus, TeamRole } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createInvitation,
  createTeam as seedTeam,
  createUser,
} from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { query } from './support/test-connection';

/**
 * Read a user's stored role in a team.
 * @param teamId The team
 * @param userId The user
 * @returns The role, or undefined when the user is not a member
 */
const readRole = async (teamId: string, userId: string): Promise<TeamRole | undefined> => {
  const rows = await query<{ role: TeamRole }[]>(
    'SELECT role FROM team_memberships WHERE team_id = ? AND user_id = ?',
    [teamId, userId]
  );
  return rows[0]?.role;
};

describe('teams', () => {
  describe('structure', () => {
    it('has the expected teams columns (04-bingo-teams.md – Team Creation)', async () => {
      // Act
      const columns = await getColumns('teams');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });

    it('has the expected team_memberships columns (04-bingo-teams.md – Admins)', async () => {
      // Act
      const columns = await getColumns('team_memberships');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'role', type: "enum('leader','member')", nullable: true, generated: false },
        { name: 'joined_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });

    it('has the expected team_invitations columns (04-bingo-teams.md – Invitations / Joining)', async () => {
      // Act
      const columns = await getColumns('team_invitations');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'invite_code', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'invited_email', type: 'varchar(255)', nullable: true, generated: false },
        { name: 'invited_user_id', type: 'varchar(36)', nullable: true, generated: false },
        {
          name: 'status',
          type: "enum('pending','accepted','declined','expired')",
          nullable: true,
          generated: false,
        },
        { name: 'expires_at', type: 'datetime', nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });

  describe('operations', () => {
    it('creates a team with its creator as Team Admin (04-bingo-teams.md – Team Creation)', async () => {
      // Arrange
      const creator = await createUser();

      // Act
      const team = await createTeam('Runners', creator.id);

      // Assert
      expect(team.name).toBe('Runners');
      expect(await readRole(team.id, creator.id)).toBe(TeamRole.LEADER);
      expect(await countRows('team_memberships', 'team_id = ?', [team.id])).toBe(1);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
    });

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

    it('promotes a member so the team has two admins (04-bingo-teams.md – Admins)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);

      // Act
      const result = await promoteToLeader(team.id, member.id);

      // Assert
      expect(result.success).toBe(true);
      expect(await readRole(team.id, member.id)).toBe(TeamRole.LEADER);
      expect(await countRows('team_memberships', "team_id = ? AND role = 'leader'", [team.id])).toBe(2);
    });

    it('deletes a team with its memberships, invitations and games, leaving other teams intact (04-bingo-teams.md – Team Deletion)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      await createInvitation(team);
      const game = await seedGame(team, [leader]);
      await createCard(game, leader, [{}]);
      const otherTeam = await seedTeam(leader);

      // Act
      await deleteTeam(team.id);

      // Assert
      expect(await countRows('teams', 'id = ?', [team.id])).toBe(0);
      expect(await countRows('team_memberships', 'team_id = ?', [team.id])).toBe(0);
      expect(await countRows('team_invitations', 'team_id = ?', [team.id])).toBe(0);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('teams', 'id = ?', [otherTeam.id])).toBe(1);
    });

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

    it('promoting a member who is already a Team Admin (04-bingo-teams.md – Admins)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);

      // Act
      const result = await promoteToLeader(team.id, leader.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'User is already a Team Admin' });
    });

    it('promoting a user who is not a member (04-bingo-teams.md – Admins)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const outsider = await createUser();

      // Act
      const result = await promoteToLeader(team.id, outsider.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'User is not a member of this team' });
      expect(await readRole(team.id, outsider.id)).toBeUndefined();
    });

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
