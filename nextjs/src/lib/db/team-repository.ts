/**
 * Team Repository - Database operations for teams
 * Spec Reference: 04-bingo-teams.md
 */

import { query, getConnection } from './connection';
import type {
  Team,
  TeamMembership,
  TeamInvitation,
  TeamWithMembers,
  TeamMemberWithProfile,
} from './types';
import { v4 as uuidv4 } from 'uuid';
import { getPublicUserProfile } from './user-repository';
import {
  getTeamGoalResolution,
  setTeamGoalResolution,
  getMemberProvidedResolutionsByUser,
  getMemberProvidedResolutionsForUser,
  createOrUpdateMemberProvidedResolution,
} from './resolution-repository';
import type { RowDataPacket } from 'mysql2/promise';
import { TeamStatus, TeamRole, InvitationStatus, ResolutionType } from '../shared/types';

// Row types from database (snake_case)
interface TeamRow extends RowDataPacket {
  id: string;
  name: string;
  leader_user_id: string;
  // Derived from LEFT JOIN with resolutions (scope='team')
  team_resolution_text: string | null;
  status: TeamStatus;
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
    leaderUserId: row.leader_user_id,
    teamResolutionText: row.team_resolution_text,
    status: row.status,
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
  const connection = await getConnection();
  
  try {
    await connection.beginTransaction();

    const teamId = uuidv4();
    const membershipId = uuidv4();

    // Create team
    await connection.execute(
      `INSERT INTO teams (id, name, leader_user_id, status) VALUES (?, ?, ?, 'forming')`,
      [teamId, name, leaderUserId]
    );

    // Add leader as member with 'leader' role
    await connection.execute(
      `INSERT INTO team_memberships (id, team_id, user_id, role) VALUES (?, ?, ?, 'leader')`,
      [membershipId, teamId, leaderUserId]
    );

    await connection.commit();

    const rows = await query<TeamRow[]>(
      `SELECT * FROM teams WHERE id = ?`,
      [teamId]
    );

    return rowToTeam(rows[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get team by ID
 * Derives teamResolutionText from the team goal resolution entity.
 */
export async function getTeamById(id: string): Promise<Team | null> {
  const rows = await query<TeamRow[]>(
    `SELECT t.*, COALESCE(r.description, r.title) AS team_resolution_text
     FROM teams t
     LEFT JOIN resolutions r ON r.team_id = t.id AND r.scope = 'team'
     WHERE t.id = ?`,
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
    `SELECT t.*, r.description AS team_resolution_text
     FROM teams t
     JOIN team_memberships m ON t.id = m.team_id
     LEFT JOIN resolutions r ON r.team_id = t.id AND r.scope = 'team'
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
 * Check if user is team leader
 * Spec: 04-bingo-teams.md - Permissions
 */
export async function isTeamLeader(teamId: string, userId: string): Promise<boolean> {
  const rows = await query<MembershipRow[]>(
    `SELECT * FROM team_memberships WHERE team_id = ? AND user_id = ? AND role = 'leader'`,
    [teamId, userId]
  );
  return rows.length > 0;
}

/**
 * Set team resolution (goal)
 * Spec: 04-bingo-teams.md - Team Resolution
 * Creates or updates a resolution entity with scope='team'.
 */
export async function setTeamResolution(
  teamId: string,
  leaderUserId: string,
  resolutionText: string,
  resolutionType: ResolutionType = ResolutionType.BASE,
  subtasks?: import('../shared/types').Subtask[],
  numberOfRepetition?: number
): Promise<Team | null> {
  // Only team leader can set the team resolution
  const leader = await isTeamLeader(teamId, leaderUserId);
  if (!leader) {
    return null;
  }

  const trimmed = resolutionText.trim();
  const title = trimmed.slice(0, 255);

  await setTeamGoalResolution(teamId, leaderUserId, title, trimmed, resolutionType, subtasks, numberOfRepetition);

  return getTeamById(teamId);
}

/**
 * Create team invitation
 * Spec: 04-bingo-teams.md - Invitations / Joining
 */
export async function createTeamInvitation(
  teamId: string,
  leaderUserId: string,
  invitedEmail?: string
): Promise<TeamInvitation | null> {
  // Only team leader can invite
  const isLeader = await isTeamLeader(teamId, leaderUserId);
  if (!isLeader) {
    return null;
  }

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
  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Find valid invitation
    const [invitationRows] = await connection.execute<InvitationRow[]>(
      `SELECT * FROM team_invitations 
       WHERE invite_code = ? AND status = 'pending' AND expires_at > NOW()`,
      [inviteCode]
    );

    const invitations = invitationRows as InvitationRow[];
    if (invitations.length === 0) {
      await connection.rollback();
      return { success: false, error: 'Invalid or expired invitation' };
    }

    const invitation = invitations[0];

    // Check if already a member
    const [memberRows] = await connection.execute<MembershipRow[]>(
      `SELECT * FROM team_memberships WHERE team_id = ? AND user_id = ?`,
      [invitation.team_id, userId]
    );

    if ((memberRows as MembershipRow[]).length > 0) {
      await connection.rollback();
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

    await connection.commit();

    const team = await getTeamById(invitation.team_id);
    return { success: true, team: team || undefined };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
 * Create a team-provided resolution (member to member)
 * Spec: 04-bingo-teams.md - Member-Provided Resolutions
 * Delegates to the unified resolution repository.
 */
export async function createTeamProvidedResolution(
  teamId: string,
  fromUserId: string,
  toUserId: string,
  text: string,
  title?: string,
  resolutionType: ResolutionType = ResolutionType.BASE,
  subtasks?: import('../shared/types').Subtask[],
  numberOfRepetition?: number
): Promise<import('./types').Resolution | null> {
  // Verify both users are team members
  const fromIsMember = await isTeamMember(teamId, fromUserId);
  const toIsMember = await isTeamMember(teamId, toUserId);

  if (!fromIsMember || !toIsMember) {
    return null;
  }

  const trimmedText = text.trim();
  const resolvedTitle = title ? title.trim().slice(0, 255) : trimmedText.slice(0, 255);

  return createOrUpdateMemberProvidedResolution(
    teamId, fromUserId, toUserId, resolvedTitle, trimmedText,
    resolutionType, subtasks, numberOfRepetition
  );
}

/**
 * Get team-provided resolutions for a user (resolutions others made for them)
 */
export async function getTeamProvidedResolutionsForUser(
  teamId: string,
  toUserId: string
): Promise<import('./types').Resolution[]> {
  return getMemberProvidedResolutionsForUser(teamId, toUserId);
}

/**
 * Get team-provided resolutions by a user (resolutions they made for others)
 */
export async function getTeamProvidedResolutionsByUser(
  teamId: string,
  fromUserId: string
): Promise<import('./types').Resolution[]> {
  return getMemberProvidedResolutionsByUser(teamId, fromUserId);
}

/**
 * Check if all required resolutions are provided
 * Spec: 04-bingo-teams.md - Start Conditions
 */
export async function checkAllResolutionsProvided(teamId: string): Promise<{
  ready: boolean;
  missing: { fromUserId: string; toUserId: string }[];
}> {
  // Get all team members
  const members = await getTeamMembers(teamId);
  const memberIds = members.map(m => m.userId);

  // If there are fewer than 2 members, there are no (from -> to) pairs required.
  // Spec: 04-bingo-teams.md - all members have provided a resolution for every other member.
  // For a 1-person team, that condition is vacuously satisfied.
  if (memberIds.length < 2) {
    return { ready: true, missing: [] };
  }

  // Get all provided resolutions (from unified resolutions table)
  const providedRows = await query<{ owner_user_id: string; to_user_id: string }[]>(
    `SELECT owner_user_id, to_user_id FROM resolutions
     WHERE scope = 'member_provided' AND team_id = ?`,
    [teamId]
  );

  const providedSet = new Set(
    providedRows.map(r => `${r.owner_user_id}->${r.to_user_id}`)
  );

  // Check each pair
  const missing: { fromUserId: string; toUserId: string }[] = [];

  for (const fromId of memberIds) {
    for (const toId of memberIds) {
      if (fromId !== toId) {
        const key = `${fromId}->${toId}`;
        if (!providedSet.has(key)) {
          missing.push({ fromUserId: fromId, toUserId: toId });
        }
      }
    }
  }

  return {
    ready: missing.length === 0,
    missing,
  };
}

/**
 * Start the bingo game
 * Spec: 04-bingo-teams.md - Start Conditions
 */
export async function startBingoGame(
  teamId: string,
  leaderUserId: string
): Promise<{ success: boolean; error?: string }> {
  // Only team leader can start
  const isLeader = await isTeamLeader(teamId, leaderUserId);
  if (!isLeader) {
    return { success: false, error: 'Only the team leader can start the game' };
  }

  // Check if team is still in forming status
  const team = await getTeamById(teamId);
  if (!team || team.status !== 'forming') {
    return { success: false, error: 'Team is not in forming status' };
  }

  // Check if team resolution is set (via resolution entity)
  const teamGoal = await getTeamGoalResolution(teamId);
  if (!teamGoal) {
    return { success: false, error: 'Team resolution must be set before starting' };
  }

  // Check if all resolutions are provided
  const { ready, missing } = await checkAllResolutionsProvided(teamId);
  if (!ready) {
    return {
      success: false,
      error: `Not all members have provided resolutions for all other members. Missing: ${missing.length} resolutions`,
    };
  }

  // Update team status
  await query(
    `UPDATE teams SET status = 'started' WHERE id = ?`,
    [teamId]
  );

  return { success: true };
}

/**
 * Get team invitation by code
 */
export async function getInvitationByCode(inviteCode: string): Promise<TeamInvitation | null> {
  const rows = await query<InvitationRow[]>(
    `SELECT * FROM team_invitations WHERE invite_code = ?`,
    [inviteCode]
  );
  return rows.length > 0 ? rowToInvitation(rows[0]) : null;
}

/**
 * Delete a team
 * Spec: 04-bingo-teams.md - Only team leader can manage the team
 * 
 * This is a hard delete. Due to ON DELETE CASCADE foreign keys, deleting the team
 * will automatically delete:
 * - Team memberships
 * - Team invitations
 * - Team-provided resolutions
 * - Bingo cards (and their cells, proofs, reviews, etc.)
 */
export async function deleteTeam(
  teamId: string,
  userId: string
): Promise<boolean> {
  // Only team leader can delete the team
  const isLeader = await isTeamLeader(teamId, userId);
  if (!isLeader) {
    return false;
  }

  // Delete the team (CASCADE will handle related data)
  await query(
    `DELETE FROM teams WHERE id = ?`,
    [teamId]
  );

  return true;
}
