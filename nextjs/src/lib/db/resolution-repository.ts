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
import { query, type Executor } from './connection';
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
  game_id: string | null;
  to_user_id: string | null;
  subtasks: string | Subtask[] | null;
  number_of_repetition: number | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Read a subtasks column, which the driver may return as JSON text.
 * @param value The column value
 * @returns The subtasks, or null if there are none
 */
export function parseSubtasks(value: string | Subtask[] | null): Subtask[] | null {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/**
 * Convert a database row into a Resolution entity.
 */
function rowToResolution(row: ResolutionRow): Resolution {
  const subtasks = parseSubtasks(row.subtasks);

  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    resolutionType: row.resolution_type,
    scope: row.scope,
    teamId: row.team_id,
    gameId: row.game_id,
    toUserId: row.to_user_id,
    subtasks,
    numberOfRepetition: row.number_of_repetition,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Generic helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Get a resolution by ID.
 * @param id The resolution
 * @param executor Where to read it, e.g. a transaction that just created it (default the pool)
 * @returns The resolution, or null if it does not exist
 */
export async function getResolutionById(id: string, executor?: Executor): Promise<Resolution | null> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions WHERE id = ?`,
    [id],
    executor
  );
  return rows.length > 0 ? rowToResolution(rows[0]) : null;
}

/**
 * Whether a resolution belongs to a game that has ended, which freezes it.
 * Spec: 16-games.md - Ending a Game
 * @param resolution The resolution to check
 * @returns True for a team goal or member-provided resolution of an ended game
 */
export async function isResolutionFrozen(resolution: Resolution): Promise<boolean> {
  if (!resolution.gameId) return false;

  const rows = await query<RowDataPacket[]>(
    `SELECT id FROM games WHERE id = ? AND status = 'ended'`,
    [resolution.gameId]
  );
  return rows.length > 0;
}

/**
 * Delete a resolution. Only the owner may delete, not if its game has ended, and not once
 * they have left its game (spec 16 - Leaving a Game).
 */
export async function deleteResolution(
  id: string,
  ownerUserId: string
): Promise<boolean> {
  await query(
    `DELETE FROM resolutions
     WHERE id = ? AND owner_user_id = ?
       AND (game_id IS NULL OR game_id NOT IN (SELECT id FROM games WHERE status = 'ended'))
       AND (game_id IS NULL OR EXISTS (
         SELECT 1 FROM game_players gp WHERE gp.game_id = resolutions.game_id AND gp.user_id = resolutions.owner_user_id
       ))`,
    [id, ownerUserId]
  );
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions WHERE id = ?`,
    [id]
  );
  return rows.length === 0;
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
 * Normalize subtasks: keep only the definition fields and trim them.
 * @param subtasks The submitted subtasks
 * @returns The subtasks to store, without progress
 */
function normalizeSubtasks(subtasks: Subtask[]): Subtask[] {
  return subtasks.map((st) => ({
    title: st.title.trim(),
    description: st.description?.trim() ?? '',
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
 * @param placement The scope, plus the team, game and recipient where the scope needs them
 * @param executor Where to run the insert; pass the transaction's connection to run inside it
 * @returns The new resolution's id
 */
export async function createResolution(
  ownerUserId: string,
  content: ResolutionContent,
  placement: { scope: ResolutionScope; teamId?: string; gameId?: string; toUserId?: string },
  executor?: Executor
): Promise<string> {
  const id = uuidv4();
  const { description, subtasks, numberOfRepetition } = toColumnValues(content);

  await query(
    `INSERT INTO resolutions
       (id, owner_user_id, title, description, resolution_type, scope, team_id, game_id, to_user_id, subtasks, number_of_repetition)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      ownerUserId,
      content.title,
      description,
      content.type,
      placement.scope,
      placement.teamId || null,
      placement.gameId || null,
      placement.toUserId || null,
      subtasks,
      numberOfRepetition,
    ],
    executor
  );

  return id;
}

/**
 * Update a resolution's content without changing its type.
 * Writes only the columns of content.type, leaving resolution_type untouched. Cells keep their snapshot.
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
 * Change a resolution's type. Cells filled from it keep their snapshot (spec 03).
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

  await query(
    `UPDATE resolutions SET title = ?, description = ?, resolution_type = ?,
     subtasks = ?, number_of_repetition = ?
     WHERE id = ? AND owner_user_id = ?`,
    [content.title, description, content.type, subtasks, numberOfRepetition, id, ownerUserId]
  );
}

// ═══════════════════════════════════════════════════════════════════
// Personal resolutions (scope = personal)
// ═══════════════════════════════════════════════════════════════════

/**
 * List a player's personal resolutions of a game, newest first.
 * Spec: 03-personal-resolutions.md - Read
 * @param gameId The game
 * @param userId The player
 * @returns Their resolutions
 */
export async function getPlayerGameResolutions(gameId: string, userId: string): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE game_id = ? AND owner_user_id = ? AND scope = 'personal'
     ORDER BY created_at DESC, id`,
    [gameId, userId]
  );
  return rows.map(rowToResolution);
}

/**
 * List a user's legacy personal resolutions, which belong to no game, newest first.
 * LEGACY-PERSONAL-RESOLUTIONS: remove after 2027-05-08, with the /resolutions page.
 * Spec: 03-personal-resolutions.md - Legacy Personal Resolutions
 * @param userId The user
 * @returns Their legacy resolutions
 */
export async function getLegacyPersonalResolutions(userId: string): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE owner_user_id = ? AND scope = 'personal' AND game_id IS NULL
     ORDER BY created_at DESC, id`,
    [userId]
  );
  return rows.map(rowToResolution);
}

/**
 * Pick random personal resolutions of a player in a game, to fill their card.
 * Spec: 05-bingo-card-generation.md - Generation Rules (step 5)
 * @param gameId The game
 * @param userId The card owner
 * @param limit How many to pick at most
 * @param excludeTexts Texts already on the card, which are left out
 * @returns The picked resolutions
 */
export async function getRandomResolutions(
  gameId: string,
  userId: string,
  limit: number,
  excludeTexts: string[] = []
): Promise<Resolution[]> {
  if (limit <= 0) return [];

  let sql = `SELECT * FROM resolutions WHERE game_id = ? AND owner_user_id = ? AND scope = 'personal'`;
  const params: unknown[] = [gameId, userId];

  if (excludeTexts.length > 0) {
    sql += ` AND COALESCE(description, title) NOT IN (${excludeTexts.map(() => '?').join(', ')})`;
    params.push(...excludeTexts);
  }

  sql += ` ORDER BY RAND() LIMIT ?`;
  params.push(limit);

  const rows = await query<ResolutionRow[]>(sql, params);
  return rows.map(rowToResolution);
}

// ═══════════════════════════════════════════════════════════════════
// Team goal resolutions (scope = team)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get the team goal resolution of a game.
 * Returns the single resolution with scope='team' and matching game_id.
 */
export async function getGameGoalResolution(gameId: string): Promise<Resolution | null> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions WHERE game_id = ? AND scope = 'team' LIMIT 1`,
    [gameId]
  );
  return rows.length > 0 ? rowToResolution(rows[0]) : null;
}

// ═══════════════════════════════════════════════════════════════════
// Member-provided resolutions (scope = member_provided)
// ═══════════════════════════════════════════════════════════════════

/**
 * Get all member-provided resolutions targeted at a user within a game.
 */
export async function getMemberProvidedResolutionsForUser(
  gameId: string,
  toUserId: string
): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE scope = 'member_provided' AND game_id = ? AND to_user_id = ?`,
    [gameId, toUserId]
  );
  return rows.map(rowToResolution);
}

/**
 * Get all member-provided resolutions written by a user within a game.
 */
export async function getMemberProvidedResolutionsByUser(
  gameId: string,
  fromUserId: string
): Promise<Resolution[]> {
  const rows = await query<ResolutionRow[]>(
    `SELECT * FROM resolutions
     WHERE scope = 'member_provided' AND game_id = ? AND owner_user_id = ?`,
    [gameId, fromUserId]
  );
  return rows.map(rowToResolution);
}
