/**
 * Team Repository - Database operations for teams
 * Spec Reference: 04-bingo-teams.md
 */

import type { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { InvitationStatus, TeamRole } from '../shared/types';
import { execute, query, withTransaction } from './connection';
import { getTeamReviewFiles, removeOrphanedFiles } from './review-file-repository';
import type {
  Team,
  TeamInvitation,
  TeamMembership,
  TeamMemberWithProfile,
  TeamWithMembers,
} from './types';
import { getPublicUserProfile } from './user-repository';

// Row types from database (snake_case)
interface TeamRow extends RowDataPacket {
  id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

interface MembershipRow extends RowDataPacket {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  joined_at: Date;
}

interface InvitationRow extends RowDataPacket {
  id: string;
  team_id: string;
  invite_code: string;
  invited_email: string | null;
  invited_user_id: string | null;
  status: InvitationStatus;
  expires_at: Date;
  created_at: Date;
}

// Convert functions
function rowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToMembership(row: MembershipRow): TeamMembership {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

function rowToInvitation(row: InvitationRow): TeamInvitation {
  return {
    id: row.id,
    teamId: row.team_id,
    inviteCode: row.invite_code,
    invitedEmail: row.invited_email,
    invitedUserId: row.invited_user_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

/**
 * Create a new team
 * Spec: 04-bingo-teams.md - Team Creation
 */
export async function createTeam(
  name: string,
  leaderUserId: string
): Promise<Team> {
  const teamId = uuidv4();
  const membershipId = uuidv4();

  await withTransaction(async (connection) => {
    // Create team
    await connection.execute(
      `INSERT INTO teams (id, name) VALUES (?, ?)`,
      [teamId, name]
    );

    // Add leader as member with 'leader' role
    await connection.execute(
      `INSERT INTO team_memberships (id, team_id, user_id, role) VALUES (?, ?, ?, 'leader')`,
      [membershipId, teamId, leaderUserId]
    );
  });

  const rows = await query<TeamRow[]>(
    `SELECT * FROM teams WHERE id = ?`,
    [teamId]
  );

  return rowToTeam(rows[0]);
}

/**
 * Get team by ID
 */
export async function getTeamById(id: string): Promise<Team | null> {
  const rows = await query<TeamRow[]>(
    `SELECT * FROM teams WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? rowToTeam(rows[0]) : null;
}

/**
 * Get team with members
 */
export async function getTeamWithMembers(teamId: string): Promise<TeamWithMembers | null> {
  const team = await getTeamById(teamId);
  if (!team) return null;

  const memberRows = await query<MembershipRow[]>(
    `SELECT * FROM team_memberships WHERE team_id = ? ORDER BY joined_at ASC`,
    [teamId]
  );

  const members: TeamMemberWithProfile[] = [];
  for (const row of memberRows) {
    const profile = await getPublicUserProfile(row.user_id);
    if (profile) {
      members.push({
        membership: rowToMembership(row),
        user: profile,
      });
    }
  }

  return {
    ...team,
    members,
  };
}

/**
 * Get teams for a user
 */
export async function getTeamsForUser(userId: string): Promise<Team[]> {
  const rows = await query<TeamRow[]>(
    `SELECT t.*
     FROM teams t
     JOIN team_memberships m ON t.id = m.team_id
     WHERE m.user_id = ?
     ORDER BY t.created_at DESC`,
    [userId]
  );

  return rows.map(rowToTeam);
}

/**
 * Check if user is team member
 */
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const rows = await query<MembershipRow[]>(
    `SELECT * FROM team_memberships WHERE team_id = ? AND user_id = ?`,
    [teamId, userId]
  );
  return rows.length > 0;
}

/**
 * Make a team member a leader. The caller checks that the acting user is a leader.
 * Spec: 04-bingo-teams.md - Leaders
 * @param teamId The team
 * @param userId The member to promote
 * @returns An error when the user is not a member or is already a leader
 */
export async function promoteToLeader(
  teamId: string,
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const result = await execute(
    `UPDATE team_memberships SET role = 'leader' WHERE team_id = ? AND user_id = ? AND role <> 'leader'`,
    [teamId, userId]
  );
  if (result.affectedRows > 0) {
    return { success: true };
  }

  const isMember = await isTeamMember(teamId, userId);
  return { success: false, error: isMember ? 'User is already a leader' : 'User is not a member of this team' };
}

/**
 * Create a team invitation. The caller checks that the user may invite (spec 21: team.invite).
 * Spec: 04-bingo-teams.md - Invitations / Joining
 * @param teamId The team
 * @param invitedEmail An optional email stored on the invitation
 * @returns The invitation
 */
export async function createTeamInvitation(
  teamId: string,
  invitedEmail?: string
): Promise<TeamInvitation> {
  const id = uuidv4();
  const inviteCode = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await query(
    `INSERT INTO team_invitations (id, team_id, invite_code, invited_email, expires_at) VALUES (?, ?, ?, ?, ?)`,
    [id, teamId, inviteCode, invitedEmail || null, expiresAt]
  );

  const rows = await query<InvitationRow[]>(
    `SELECT * FROM team_invitations WHERE id = ?`,
    [id]
  );

  return rowToInvitation(rows[0]);
}

/**
 * Join team using invite code
 * Spec: 04-bingo-teams.md - Invitations / Joining
 */
export async function joinTeamByInviteCode(
  inviteCode: string,
  userId: string
): Promise<{ success: boolean; team?: Team; error?: string }> {
  const result = await withTransaction<{ success: boolean; teamId?: string; error?: string }>(
    async (connection) => {
      // Find valid invitation
      const invitations = await query<InvitationRow[]>(
        `SELECT * FROM team_invitations
         WHERE invite_code = ? AND status = 'pending' AND expires_at > NOW()`,
        [inviteCode],
        connection
      );

      if (invitations.length === 0) {
        return { success: false, error: 'Invalid or expired invitation' };
      }

      const invitation = invitations[0];

      // Check if already a member
      const memberRows = await query<MembershipRow[]>(
        `SELECT * FROM team_memberships WHERE team_id = ? AND user_id = ?`,
        [invitation.team_id, userId],
        connection
      );

      if (memberRows.length > 0) {
        return { success: false, error: 'Already a member of this team' };
      }

      // Add as member
      const membershipId = uuidv4();
      await connection.execute(
        `INSERT INTO team_memberships (id, team_id, user_id, role) VALUES (?, ?, ?, 'member')`,
        [membershipId, invitation.team_id, userId]
      );

      // Mark invitation as accepted
      await connection.execute(
        `UPDATE team_invitations SET status = 'accepted', invited_user_id = ? WHERE id = ?`,
        [userId, invitation.id]
      );

      return { success: true, teamId: invitation.team_id };
    },
    (outcome) => outcome.success
  );

  if (!result.teamId) {
    return { success: false, error: result.error };
  }

  const team = await getTeamById(result.teamId);
  return { success: true, team: team || undefined };
}

/**
 * Get team members
 */
export async function getTeamMembers(teamId: string): Promise<TeamMembership[]> {
  const rows = await query<MembershipRow[]>(
    `SELECT * FROM team_memberships WHERE team_id = ? ORDER BY joined_at ASC`,
    [teamId]
  );
  return rows.map(rowToMembership);
}

/**
 * Delete a team. The caller checks that the user may delete it (spec 21: team.delete).
 * Spec: 04-bingo-teams.md - Team Deletion
 * 
 * This is a hard delete. Due to ON DELETE CASCADE foreign keys, deleting the team
 * will automatically delete:
 * - Team memberships
 * - Team invitations
 * - Games, with their resolutions and bingo cards (and cells, proofs, reviews, etc.)
 */
export async function deleteTeam(teamId: string): Promise<void> {
  // Collected first: the cascade below removes the rows that name these files
  const reviewFiles = await getTeamReviewFiles(teamId);

  // Delete the team (CASCADE will handle related data)
  await query(
    `DELETE FROM teams WHERE id = ?`,
    [teamId]
  );

  await removeOrphanedFiles(reviewFiles);
}
