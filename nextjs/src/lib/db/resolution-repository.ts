/**
 * Unified Resolution Repository - Database operations for ALL resolutions
 * Spec Reference: 03-personal-resolutions.md, 04-bingo-teams.md
 *
 * After V3.2.0, every resolution (personal, team-goal, member-provided)
 * of every type (base, compound, iterative) lives in the `resolutions` table.
 */

import { query } from './connection';
import type { Resolution } from './types';
import { ResolutionType, ResolutionScope } from '../shared/types';
import type { Subtask } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

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
export async function getResolutionsByUserAndType(
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
 * Create a personal base resolution.
 * Spec: 03-personal-resolutions.md – Create
 */
export async function createResolution(
  ownerUserId: string,
  description: string,
  title?: string
): Promise<Resolution> {
  if (!description || description.trim().length === 0) {
    throw new Error('Resolution description must be non-empty');
  }
  const id = uuidv4();
  const trimmedDesc = description.trim();
  const resolvedTitle = title ? title.trim().slice(0, 255) : trimmedDesc.slice(0, 255);
  if (!resolvedTitle) throw new Error('Resolution title must be non-empty');

  await query(
    `INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope)
     VALUES (?, ?, ?, ?, 'base', 'personal')`,
    [id, ownerUserId, resolvedTitle, trimmedDesc]
  );
  return (await getResolutionById(id))!;
}

/**
 * Update a personal base resolution.
 * Spec: 03-personal-resolutions.md – Update
 */
export async function updateResolution(
  id: string,
  ownerUserId: string,
  description: string,
  title?: string
): Promise<Resolution | null> {
  if (!description || description.trim().length === 0) {
    throw new Error('Resolution description must be non-empty');
  }
  const trimmedDesc = description.trim();
  const resolvedTitle = title ? title.trim().slice(0, 255) : trimmedDesc.slice(0, 255);
  if (!resolvedTitle) throw new Error('Resolution title must be non-empty');

  await query(
    `UPDATE resolutions SET title = ?, description = ? WHERE id = ? AND owner_user_id = ?`,
    [resolvedTitle, trimmedDesc, id, ownerUserId]
  );
  const row = await getResolutionById(id);
  return row && row.ownerUserId === ownerUserId ? row : null;
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

function normalizeSubtasks(subtasks: Subtask[]): Subtask[] {
  return subtasks.map((st) => ({
    title: st.title.trim(),
    description: st.description?.trim() ?? '',
    completed: st.completed ?? false,
  }));
}

/**
 * Create a compound resolution.
 */
export async function createCompoundResolution(
  ownerUserId: string,
  title: string,
  subtasks: Subtask[],
  description?: string | null,
  scope: ResolutionScope = ResolutionScope.PERSONAL,
  teamId?: string | null,
  toUserId?: string | null
): Promise<Resolution> {
  const id = uuidv4();
  const normalized = normalizeSubtasks(subtasks);
  await query(
    `INSERT INTO resolutions
     (id, owner_user_id, title, description, resolution_type, scope, team_id, to_user_id, subtasks)
     VALUES (?, ?, ?, ?, 'compound', ?, ?, ?, ?)`,
    [id, ownerUserId, title.trim().slice(0, 255), description?.trim() || null,
     scope, teamId || null, toUserId || null, JSON.stringify(normalized)]
  );
  return (await getResolutionById(id))!;
}

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
 * Update a compound resolution.
 */
export async function updateCompoundResolution(
  id: string,
  ownerUserId: string,
  updates: { title?: string; description?: string | null; subtasks?: Subtask[] }
): Promise<Resolution | null> {
  const existing = await getCompoundResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title.trim().slice(0, 255));
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description?.trim() || null);
  }
  if (updates.subtasks !== undefined) {
    sets.push('subtasks = ?');
    params.push(JSON.stringify(normalizeSubtasks(updates.subtasks)));
  }
  if (sets.length === 0) return existing;

  params.push(id, ownerUserId);
  await query(
    `UPDATE resolutions SET ${sets.join(', ')} WHERE id = ? AND owner_user_id = ?`,
    params
  );
  return getResolutionById(id);
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
  if (!existing || existing.ownerUserId !== ownerUserId || !existing.subtasks) return null;

  if (subtaskIndex < 0 || subtaskIndex >= existing.subtasks.length) return null;

  const updated = [...existing.subtasks];
  updated[subtaskIndex] = { ...updated[subtaskIndex], completed: !updated[subtaskIndex].completed };

  await query(
    `UPDATE resolutions SET subtasks = ? WHERE id = ? AND owner_user_id = ?`,
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
 * Create an iterative resolution.
 */
export async function createIterativeResolution(
  ownerUserId: string,
  title: string,
  numberOfRepetition: number,
  description?: string | null,
  scope: ResolutionScope = ResolutionScope.PERSONAL,
  teamId?: string | null,
  toUserId?: string | null
): Promise<Resolution> {
  const id = uuidv4();
  await query(
    `INSERT INTO resolutions
     (id, owner_user_id, title, description, resolution_type, scope, team_id, to_user_id, number_of_repetition, completed_times)
     VALUES (?, ?, ?, ?, 'iterative', ?, ?, ?, ?, 0)`,
    [id, ownerUserId, title.trim().slice(0, 255), description?.trim() || null,
     scope, teamId || null, toUserId || null, numberOfRepetition]
  );
  return (await getResolutionById(id))!;
}

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
 * Update an iterative resolution.
 */
export async function updateIterativeResolution(
  id: string,
  ownerUserId: string,
  updates: { title?: string; description?: string | null; numberOfRepetition?: number }
): Promise<Resolution | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) return null;

  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.title !== undefined) {
    sets.push('title = ?');
    params.push(updates.title.trim().slice(0, 255));
  }
  if (updates.description !== undefined) {
    sets.push('description = ?');
    params.push(updates.description?.trim() || null);
  }
  if (updates.numberOfRepetition !== undefined) {
    sets.push('number_of_repetition = ?');
    params.push(updates.numberOfRepetition);
  }
  if (sets.length === 0) return existing;

  params.push(id, ownerUserId);
  await query(
    `UPDATE resolutions SET ${sets.join(', ')} WHERE id = ? AND owner_user_id = ?`,
    params
  );
  return getResolutionById(id);
}

/**
 * Increment the completed_times counter.
 */
export async function incrementIterativeResolution(
  id: string,
  ownerUserId: string
): Promise<Resolution | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) return null;

  await query(
    `UPDATE resolutions SET completed_times = completed_times + 1 WHERE id = ? AND owner_user_id = ?`,
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
  if (!existing || existing.ownerUserId !== ownerUserId) return null;
  if (existing.completedTimes <= 0) return existing;

  await query(
    `UPDATE resolutions SET completed_times = completed_times - 1 WHERE id = ? AND owner_user_id = ?`,
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

/**
 * Create or update the team goal resolution.
 * @param teamId - The team ID
 * @param ownerUserId - The team leader's user ID
 * @param title - Title for the resolution
 * @param description - Full description
 * @param resolutionType - base, compound, or iterative (default: base)
 * @param subtasks - For compound type
 * @param numberOfRepetition - For iterative type
 */
export async function setTeamGoalResolution(
  teamId: string,
  ownerUserId: string,
  title: string,
  description: string,
  resolutionType: ResolutionType = ResolutionType.BASE,
  subtasks?: Subtask[],
  numberOfRepetition?: number
): Promise<Resolution> {
  const existing = await getTeamGoalResolution(teamId);
  const trimmedTitle = title.trim().slice(0, 255);
  const trimmedDesc = description.trim();

  if (existing) {
    // Update existing
    const sets = [
      'title = ?', 'description = ?', 'resolution_type = ?', 'owner_user_id = ?'
    ];
    const params: unknown[] = [trimmedTitle, trimmedDesc, resolutionType, ownerUserId];

    sets.push('subtasks = ?');
    params.push(resolutionType === ResolutionType.COMPOUND && subtasks
      ? JSON.stringify(normalizeSubtasks(subtasks)) : null);

    sets.push('number_of_repetition = ?');
    params.push(resolutionType === ResolutionType.ITERATIVE ? numberOfRepetition ?? null : null);

    if (resolutionType !== ResolutionType.ITERATIVE) {
      sets.push('completed_times = 0');
    }

    params.push(existing.id);
    await query(`UPDATE resolutions SET ${sets.join(', ')} WHERE id = ?`, params);
    return (await getResolutionById(existing.id))!;
  }

  // Create new
  const id = uuidv4();
  await query(
    `INSERT INTO resolutions
     (id, owner_user_id, title, description, resolution_type, scope, team_id, subtasks, number_of_repetition)
     VALUES (?, ?, ?, ?, ?, 'team', ?, ?, ?)`,
    [id, ownerUserId, trimmedTitle, trimmedDesc, resolutionType, teamId,
     resolutionType === ResolutionType.COMPOUND && subtasks
       ? JSON.stringify(normalizeSubtasks(subtasks)) : null,
     resolutionType === ResolutionType.ITERATIVE ? numberOfRepetition ?? null : null]
  );
  return (await getResolutionById(id))!;
}

// ═══════════════════════════════════════════════════════════════════
// Member-provided resolutions (scope = member_provided)
// ═══════════════════════════════════════════════════════════════════

/**
 * Create or update a member-provided resolution.
 * Spec: 04-bingo-teams.md – Member-Provided Resolutions
 *
 * @param teamId - The team
 * @param fromUserId - Who wrote the resolution
 * @param toUserId - Who the resolution is for
 * @param title - Short title
 * @param description - Full description text
 * @param resolutionType - base | compound | iterative (default: base)
 * @param subtasks - For compound type
 * @param numberOfRepetition - For iterative type
 */
export async function createOrUpdateMemberProvidedResolution(
  teamId: string,
  fromUserId: string,
  toUserId: string,
  title: string,
  description: string,
  resolutionType: ResolutionType = ResolutionType.BASE,
  subtasks?: Subtask[],
  numberOfRepetition?: number
): Promise<Resolution | null> {
  // Spec: A member cannot create a "for myself" entry
  if (fromUserId === toUserId) return null;

  const trimmedTitle = title.trim().slice(0, 255);
  const trimmedDesc = description.trim();

  // Check for existing resolution (one per from→to per team)
  const existing = await getMemberProvidedResolution(teamId, fromUserId, toUserId);

  if (existing) {
    // Update existing
    const sets = ['title = ?', 'description = ?', 'resolution_type = ?'];
    const params: unknown[] = [trimmedTitle, trimmedDesc, resolutionType];

    sets.push('subtasks = ?');
    params.push(resolutionType === ResolutionType.COMPOUND && subtasks
      ? JSON.stringify(normalizeSubtasks(subtasks)) : null);

    sets.push('number_of_repetition = ?');
    params.push(resolutionType === ResolutionType.ITERATIVE ? numberOfRepetition ?? null : null);

    if (resolutionType !== ResolutionType.ITERATIVE) {
      sets.push('completed_times = 0');
    }

    params.push(existing.id);
    await query(`UPDATE resolutions SET ${sets.join(', ')} WHERE id = ?`, params);
    return getResolutionById(existing.id);
  }

  // Create new
  const id = uuidv4();
  await query(
    `INSERT INTO resolutions
     (id, owner_user_id, title, description, resolution_type, scope,
      team_id, to_user_id, subtasks, number_of_repetition)
     VALUES (?, ?, ?, ?, ?, 'member_provided', ?, ?, ?, ?)`,
    [id, fromUserId, trimmedTitle, trimmedDesc, resolutionType,
     teamId, toUserId,
     resolutionType === ResolutionType.COMPOUND && subtasks
       ? JSON.stringify(normalizeSubtasks(subtasks)) : null,
     resolutionType === ResolutionType.ITERATIVE ? numberOfRepetition ?? null : null]
  );
  return getResolutionById(id);
}

/**
 * Get a specific member-provided resolution.
 */
export async function getMemberProvidedResolution(
  teamId: string,
  fromUserId: string,
  toUserId: string
): Promise<Resolution | null> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE scope = 'member_provided' AND team_id = ? AND owner_user_id = ? AND to_user_id = ?
     LIMIT 1`,
    [teamId, fromUserId, toUserId]
  );
  return rows.length > 0 ? rowToResolution(rows[0]) : null;
}

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
