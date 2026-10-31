/**
 * Unified Resolution Repository - Database operations for ALL resolutions
 * Spec Reference: 03-personal-resolutions.md, 04-bingo-teams.md
 *
 * After V3.2.0, every resolution (personal, team-goal, member-provided)
 * of every type (base, compound, iterative) lives in the `resolutions` table.
 */

import type { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import type { Subtask } from '../shared/types';
import { ResolutionScope, ResolutionType } from '../shared/types';
import { query, withTransaction } from './connection';
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

/**
 * Whether a user may change a resolution's progress.
 * Personal resolutions belong to their owner and member-provided ones to their recipient.
 * Team goals are owned by the team leader, so only the leader's changes count.
 * @param resolution The resolution to change
 * @param userId The user making the change
 * @returns True if the change is allowed
 */
export function canModifyProgress(resolution: Resolution, userId: string): boolean {
  if (resolution.scope === 'member_provided') return resolution.toUserId === userId;
  return resolution.ownerUserId === userId;
}

/**
 * Whether a compound or iterative resolution has reached its goal.
 * @param resolution The resolution to check
 * @returns True if all subtasks are done or the counter reached its target
 */
export function isProgressComplete(resolution: Resolution): boolean {
  if (resolution.resolutionType === ResolutionType.COMPOUND) {
    return resolution.subtasks?.every((subtask) => subtask.completed) ?? false;
  }
  return resolution.completedTimes >= (resolution.numberOfRepetition ?? Infinity);
}

/**
 * Column that must match the acting user when writing a resolution's progress.
 * @param resolution The resolution being written
 * @returns The column name, safe to interpolate into SQL
 */
function progressOwnerColumn(resolution: Resolution): 'to_user_id' | 'owner_user_id' {
  return resolution.scope === 'member_provided' ? 'to_user_id' : 'owner_user_id';
}

// ═══════════════════════════════════════════════════════════════════
// Saving resolutions
// ═══════════════════════════════════════════════════════════════════

/** The editable content of a resolution, as submitted by a user. */
export interface ResolutionContent {
  type: ResolutionType;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
}

/**
 * Normalize subtasks: ensure correct shape, trim strings.
 */
function normalizeSubtasks(subtasks: Subtask[]): Subtask[] {
  return subtasks.map((st) => ({
    title: st.title.trim(),
    description: st.description?.trim() ?? '',
    completed: st.completed ?? false,
  }));
}

/**
 * Derive the stored column values from submitted content.
 * Base resolutions fall back to their title as description. Type-specific columns are null for other types.
 * @param content The validated content
 * @returns The values for the description, subtasks and number_of_repetition columns
 */
function toColumnValues({ type, title, text, subtasks, numberOfRepetition }: ResolutionContent) {
  return {
    description: type === ResolutionType.BASE ? (text || title) : (text || null),
    subtasks: type === ResolutionType.COMPOUND ? JSON.stringify(normalizeSubtasks(subtasks!)) : null,
    numberOfRepetition: type === ResolutionType.ITERATIVE ? numberOfRepetition! : null,
  };
}

/**
 * Create a resolution.
 * @param ownerUserId The user creating it
 * @param content The validated content
 * @param placement The scope, plus the team and recipient where the scope needs them
 * @returns The new resolution's id
 */
export async function createResolution(
  ownerUserId: string,
  content: ResolutionContent,
  placement: { scope: ResolutionScope; teamId?: string; toUserId?: string }
): Promise<string> {
  const id = uuidv4();
  const { description, subtasks, numberOfRepetition } = toColumnValues(content);

  await query(
    `INSERT INTO resolutions
       (id, owner_user_id, title, description, resolution_type, scope, team_id, to_user_id, subtasks, number_of_repetition, completed_times)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      id,
      ownerUserId,
      content.title,
      description,
      content.type,
      placement.scope,
      placement.teamId || null,
      placement.toUserId || null,
      subtasks,
      numberOfRepetition,
    ]
  );

  return id;
}

/**
 * Update a resolution's content without changing its type.
 * Writes only the columns of content.type, leaving resolution_type and progress untouched.
 * @param id The resolution to update
 * @param ownerUserId Its owner; other users' rows are not matched
 * @param content The validated content
 */
export async function updateResolutionContent(
  id: string,
  ownerUserId: string,
  content: ResolutionContent
): Promise<void> {
  const { description, subtasks, numberOfRepetition } = toColumnValues(content);
  const typedColumns: Record<ResolutionType, { assignment: string; values: unknown[] }> = {
    [ResolutionType.BASE]: { assignment: '', values: [] },
    [ResolutionType.COMPOUND]: { assignment: ', subtasks = ?', values: [subtasks] },
    [ResolutionType.ITERATIVE]: { assignment: ', number_of_repetition = ?', values: [numberOfRepetition] },
  };
  const { assignment, values } = typedColumns[content.type];

  await query(
    `UPDATE resolutions SET title = ?, description = ?${assignment} WHERE id = ? AND owner_user_id = ?`,
    [content.title, description, ...values, id, ownerUserId]
  );
}

/**
 * Change a resolution's type, resetting its progress and retyping the bingo cells that reference it.
 * @param id The resolution to change
 * @param ownerUserId Its owner; other users' rows are not matched
 * @param content The validated content, whose type is the new type
 */
export async function changeResolutionType(
  id: string,
  ownerUserId: string,
  content: ResolutionContent
): Promise<void> {
  const { description, subtasks, numberOfRepetition } = toColumnValues(content);

  await withTransaction(async (connection) => {
    await connection.execute(
      `UPDATE resolutions SET title = ?, description = ?, resolution_type = ?,
       subtasks = ?, number_of_repetition = ?, completed_times = 0
       WHERE id = ? AND owner_user_id = ?`,
      [content.title, description, content.type, subtasks, numberOfRepetition, id, ownerUserId]
    );

    await connection.execute(
      `UPDATE bingo_cells SET resolution_type = ? WHERE resolution_id = ?`,
      [content.type, id]
    );
  });
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
  if (!existing || !canModifyProgress(existing, ownerUserId) || !existing.subtasks) {
    return null;
  }

  if (subtaskIndex < 0 || subtaskIndex >= existing.subtasks.length) return null;

  const updated = [...existing.subtasks];
  updated[subtaskIndex] = { ...updated[subtaskIndex], completed: !updated[subtaskIndex].completed };
  await query(
    `UPDATE resolutions SET subtasks = ? WHERE id = ? AND ${progressOwnerColumn(existing)} = ?`,
    [JSON.stringify(updated), id, ownerUserId]
  );
  return getResolutionById(id);
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
 * Move the completed_times counter one step. The counter never goes below zero.
 * @param id The iterative resolution
 * @param ownerUserId The user making the change
 * @param delta 1 to increment, -1 to decrement
 * @returns The resolution after the change, or null if the user may not change it
 */
export async function adjustIterativeProgress(
  id: string,
  ownerUserId: string,
  delta: 1 | -1
): Promise<Resolution | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing || !canModifyProgress(existing, ownerUserId)) {
    return null;
  }
  if (delta < 0 && existing.completedTimes <= 0) return existing;
  await query(
    `UPDATE resolutions SET completed_times = completed_times + ? WHERE id = ? AND ${progressOwnerColumn(existing)} = ?`,
    [delta, id, ownerUserId]
  );
  return getResolutionById(id);
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
