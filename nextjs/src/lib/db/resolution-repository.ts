/**
 * Unified Resolution Repository - Database operations for ALL resolutions
 * Spec Reference: 03-personal-resolutions.md, 04-bingo-teams.md
 *
 * After V3.2.0, every resolution (personal, team-goal, member-provided)
 * of every type (base, compound, iterative) lives in the `resolutions` table.
 */

import type { RowDataPacket } from 'mysql2/promise';
import type { Subtask } from '../shared/types';
import { ResolutionScope, ResolutionType } from '../shared/types';
import { query } from './connection';
import type { Resolution } from './types';

// ── Row type from database (snake_case) ──────────────────────────

interface ResolutionRow extends RowDataPacket {
  id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  resolution_type: ResolutionType;
  scope: ResolutionScope;
  team_id: string | null;
  to_user_id: string | null;
  subtasks: string | Subtask[] | null;
  number_of_repetition: number | null;
  completed_times: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert a database row into a Resolution entity.
 */
function rowToResolution(row: ResolutionRow): Resolution {
  let subtasks: Subtask[] | null = null;
  if (row.subtasks != null) {
    subtasks = typeof row.subtasks === 'string'
      ? JSON.parse(row.subtasks)
      : row.subtasks;
  }

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    resolutionType: row.resolution_type,
    scope: row.scope,
    teamId: row.team_id,
    toUserId: row.to_user_id,
    subtasks,
    numberOfRepetition: row.number_of_repetition,
    completedTimes: row.completed_times,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Get a resolution by ID.
 */
export async function getResolutionById(id: string): Promise<Resolution | null> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? rowToResolution(rows[0]) : null;
}

/**
 * Delete a resolution. Only the owner may delete.
 */
export async function deleteResolution(
  id: string,
  ownerUserId: string
): Promise<boolean> {
  await query(
    `DELETE FROM resolutions WHERE id = ? AND owner_user_id = ?`,
    [id, ownerUserId]
  );
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions WHERE id = ?`,
    [id]
  );
  return rows.length === 0;
}

// ═══════════════════════════════════════════════════════════════════
// Personal resolutions (scope = personal)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all personal resolutions for a user.
 * Spec: 03-personal-resolutions.md – Read
 */
export async function getResolutionsByUser(userId: string): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions WHERE owner_user_id = ? AND scope = 'personal' ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(rowToResolution);
}

/**
 * Get personal resolutions filtered by type.
 */
async function getResolutionsByUserAndType(
  userId: string,
  resolutionType: ResolutionType
): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE owner_user_id = ? AND scope = 'personal' AND resolution_type = ?
     ORDER BY created_at DESC`,
    [userId, resolutionType]
  );
  return rows.map(rowToResolution);
}

/**
 * Get random personal resolutions for bingo card filling.
 * Spec: 05-bingo-card-generation.md – fallback from personal resolutions
 */
export async function getRandomResolutions(
  userId: string,
  limit: number,
  excludeTexts: string[] = []
): Promise<Resolution[]> {
  if (limit <= 0) return [];

  let sql = `SELECT * FROM resolutions WHERE owner_user_id = ? AND scope = 'personal'`;
  const params: unknown[] = [userId];

  if (excludeTexts.length > 0) {
    sql += ` AND description NOT IN (${excludeTexts.map(() => '?').join(', ')})`;
    params.push(...excludeTexts);
  }

  sql += ` ORDER BY RAND() LIMIT ?`;
  params.push(limit);

  const rows = await query<ResolutionRow[]>(sql, params);
  return rows.map(rowToResolution);
}

// ═══════════════════════════════════════════════════════════════════
// Compound resolutions (resolution_type = compound)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get compound resolutions for a user (personal scope).
 */
export async function getCompoundResolutionsByUser(userId: string): Promise<Resolution[]> {
  return getResolutionsByUserAndType(userId, ResolutionType.COMPOUND);
}

/**
 * Get a compound resolution by ID.
 */
export async function getCompoundResolutionById(id: string): Promise<Resolution | null> {
  const row = await getResolutionById(id);
  return row && row.resolutionType === ResolutionType.COMPOUND ? row : null;
}

/**
 * Toggle a subtask's completed state.
 */
export async function toggleCompoundSubtask(
  id: string,
  ownerUserId: string,
  subtaskIndex: number
): Promise<Resolution | null> {
  const existing = await getCompoundResolutionById(id);
  if (!existing ||
    (existing.scope === 'personal' && existing.ownerUserId !== ownerUserId)   // Personal resolutions can only be modified by the owner
    || (existing.scope === 'member_provided' && existing.toUserId !== ownerUserId)  // Member-provided resolutions can only be modified by the recipient
    || !existing.subtasks) {
    return null;
  }

  if (subtaskIndex < 0 || subtaskIndex >= existing.subtasks.length) return null;

  const updated = [...existing.subtasks];
  updated[subtaskIndex] = { ...updated[subtaskIndex], completed: !updated[subtaskIndex].completed };
  const user_id_to_compare: string = existing.scope === 'member_provided' ? `to_user_id` : `owner_user_id`;
  await query(
    `UPDATE resolutions SET subtasks = ? WHERE id = ? AND ${user_id_to_compare} = ?`,
    [JSON.stringify(updated), id, ownerUserId]
  );
  return getResolutionById(id);
}

/**
 * Delete a compound resolution. Only the owner may delete.
 */
export async function deleteCompoundResolution(
  id: string,
  ownerUserId: string
): Promise<boolean> {
  return deleteResolution(id, ownerUserId);
}

// ═══════════════════════════════════════════════════════════════════
// Iterative resolutions (resolution_type = iterative)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get iterative resolutions for a user (personal scope).
 */
export async function getIterativeResolutionsByUser(userId: string): Promise<Resolution[]> {
  return getResolutionsByUserAndType(userId, ResolutionType.ITERATIVE);
}

/**
 * Get an iterative resolution by ID.
 */
export async function getIterativeResolutionById(id: string): Promise<Resolution | null> {
  const row = await getResolutionById(id);
  return row && row.resolutionType === ResolutionType.ITERATIVE ? row : null;
}

/**
 * Increment the completed_times counter.
 */
export async function incrementIterativeResolution(
  id: string,
  ownerUserId: string
): Promise<Resolution | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing ||
    (existing.scope === 'personal' && existing.ownerUserId !== ownerUserId) ||   // Personal resolutions can only be modified by the owner
    (existing.scope === 'member_provided' && existing.toUserId !== ownerUserId)  // Member-provided resolutions can only be modified by the recipient  
  ) {
    return null;
  }
  const user_id_to_compare: string = existing.scope === 'member_provided' ? `to_user_id` : `owner_user_id`;
  await query(
    `UPDATE resolutions SET completed_times = completed_times + 1 WHERE id = ? AND ${user_id_to_compare} = ?`,
    [id, ownerUserId]
  );
  return getResolutionById(id);
}

/**
 * Decrement the completed_times counter.
 */
export async function decrementIterativeResolution(
  id: string,
  ownerUserId: string
): Promise<Resolution | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing ||
    (existing.scope === 'personal' && existing.ownerUserId !== ownerUserId) ||   // Personal resolutions can only be modified by the owner
    (existing.scope === 'member_provided' && existing.toUserId !== ownerUserId)  // Member-provided resolutions can only be modified by the recipient  
  ) {
    return null;
  }
  if (existing.completedTimes <= 0) return existing;
  const user_id_to_compare: string = existing.scope === 'member_provided' ? `to_user_id` : `owner_user_id`;
  await query(
    `UPDATE resolutions SET completed_times = completed_times - 1 WHERE id = ? AND ${user_id_to_compare} = ?`,
    [id, ownerUserId]
  );
  return getResolutionById(id);
}

/**
 * Delete an iterative resolution. Only the owner may delete.
 */
export async function deleteIterativeResolution(
  id: string,
  ownerUserId: string
): Promise<boolean> {
  return deleteResolution(id, ownerUserId);
}

// ═══════════════════════════════════════════════════════════════════
// Team goal resolutions (scope = team)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the team goal resolution for a team.
 * Returns the single resolution with scope='team' and matching team_id.
 */
export async function getTeamGoalResolution(teamId: string): Promise<Resolution | null> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions WHERE team_id = ? AND scope = 'team' LIMIT 1`,
    [teamId]
  );
  return rows.length > 0 ? rowToResolution(rows[0]) : null;
}

// ═══════════════════════════════════════════════════════════════════
// Member-provided resolutions (scope = member_provided)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all member-provided resolutions targeted at a user within a team.
 */
export async function getMemberProvidedResolutionsForUser(
  teamId: string,
  toUserId: string
): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE scope = 'member_provided' AND team_id = ? AND to_user_id = ?`,
    [teamId, toUserId]
  );
  return rows.map(rowToResolution);
}

/**
 * Get all member-provided resolutions written by a user within a team.
 */
export async function getMemberProvidedResolutionsByUser(
  teamId: string,
  fromUserId: string
): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE scope = 'member_provided' AND team_id = ? AND owner_user_id = ?`,
    [teamId, fromUserId]
  );
  return rows.map(rowToResolution);
}
