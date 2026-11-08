/**
 * Prepared Resolution Repository - Reads the shared pool and copies entries out of it
 * Spec Reference: 17-prepared-resolutions.md
 */

import type { RowDataPacket } from 'mysql2/promise';
import { PreparedResolutionCategory, ResolutionScope, ResolutionType } from '../shared/types';
import type { PreparedResolution, Subtask } from '../shared/types';
import { query, type Executor } from './connection';
import { createResolution, parseSubtasks, type ResolutionContent } from './resolution-repository';

interface PreparedResolutionRow extends RowDataPacket {
  id: string;
  category: PreparedResolutionCategory;
  resolution_type: ResolutionType;
  title: string;
  description: string | null;
  subtasks: string | Subtask[] | null;
  number_of_repetition: number | null;
}

/** Why an entry could not be added to a player's personal resolutions of a game. */
export type AddPreparedResolutionError = 'not_found' | 'already_added';

/**
 * Convert a database row into a pool entry.
 * @param row The row to convert
 * @returns The pool entry
 */
function rowToPreparedResolution(row: PreparedResolutionRow): PreparedResolution {
  return {
    id: row.id,
    category: row.category,
    resolutionType: row.resolution_type,
    title: row.title,
    description: row.description,
    subtasks: parseSubtasks(row.subtasks),
    numberOfRepetition: row.number_of_repetition,
  };
}

/**
 * Get the content a copy of a pool entry starts with.
 * @param prepared The pool entry
 * @returns The content to create a resolution from
 */
export function preparedResolutionToContent(prepared: PreparedResolution): ResolutionContent {
  return {
    type: prepared.resolutionType,
    title: prepared.title,
    text: prepared.description ?? '',
    subtasks: prepared.subtasks ?? undefined,
    numberOfRepetition: prepared.numberOfRepetition ?? undefined,
  };
}

/**
 * Get the whole pool.
 * Spec: 17-prepared-resolutions.md - Browsing the Pool
 * @returns Every entry, in a stable order
 */
export async function getPreparedResolutions(): Promise<PreparedResolution[]> {
  const rows = await query<PreparedResolutionRow[]>(
    `SELECT * FROM prepared_resolutions ORDER BY category, id`
  );
  return rows.map(rowToPreparedResolution);
}

/**
 * Get random entries of a category, to fill a card.
 * Spec: 05-bingo-card-generation.md - Generation Rules
 * @param category The category to pick from
 * @param limit The most entries to return
 * @param excludeTexts Texts already used on the card
 * @returns Up to `limit` entries, in random order
 */
export async function getRandomPreparedResolutions(
  category: PreparedResolutionCategory,
  limit: number,
  excludeTexts: string[]
): Promise<PreparedResolution[]> {
  if (limit <= 0) return [];

  const exclusion = excludeTexts.length > 0
    ? `AND LOWER(COALESCE(description, title)) NOT IN (${excludeTexts.map(() => '?').join(', ')})`
    : '';
  const rows = await query<PreparedResolutionRow[]>(
    `SELECT * FROM prepared_resolutions WHERE category = ? ${exclusion} ORDER BY RAND() LIMIT ?`,
    [category, ...excludeTexts, limit]
  );
  return rows.map(rowToPreparedResolution);
}

/**
 * Pick one random entry of the whole pool, whatever its category.
 * Spec: 16-games.md - Automatic Start (a game without a goal gets one from the pool)
 * @param executor Where to read it, e.g. the start transaction (default the pool)
 * @returns The entry, or null if the pool is empty
 */
export async function getRandomPreparedEntry(executor?: Executor): Promise<PreparedResolution | null> {
  const rows = await query<PreparedResolutionRow[]>(
    `SELECT * FROM prepared_resolutions ORDER BY RAND() LIMIT 1`,
    [],
    executor
  );
  return rows.length > 0 ? rowToPreparedResolution(rows[0]) : null;
}

/**
 * Add a copy of a pool entry to a player's personal resolutions of a game.
 * The caller checks that the user plays the game and that it is running.
 * Spec: 17-prepared-resolutions.md - Adding to Personal Resolutions
 * @param preparedId The pool entry to copy
 * @param userId The player receiving the copy
 * @param gameId The game the copy belongs to
 * @returns The id of the copy, or why it was not created
 */
export async function addPreparedResolutionToGame(
  preparedId: string,
  userId: string,
  gameId: string
): Promise<{ id: string } | { error: AddPreparedResolutionError }> {
  const rows = await query<PreparedResolutionRow[]>(
    `SELECT * FROM prepared_resolutions WHERE id = ?`,
    [preparedId]
  );
  const games = await query<Array<RowDataPacket & { team_id: string }>>(
    `SELECT team_id FROM games WHERE id = ?`,
    [gameId]
  );
  if (rows.length === 0 || games.length === 0) {
    return { error: 'not_found' };
  }

  const prepared = rowToPreparedResolution(rows[0]);
  const duplicates = await query<RowDataPacket[]>(
    `SELECT id FROM resolutions
     WHERE owner_user_id = ? AND game_id = ? AND scope = 'personal'
       AND LOWER(COALESCE(description, title)) = LOWER(?)
     LIMIT 1`,
    [userId, gameId, prepared.description || prepared.title]
  );
  if (duplicates.length > 0) {
    return { error: 'already_added' };
  }

  const id = await createResolution(userId, preparedResolutionToContent(prepared), {
    scope: ResolutionScope.PERSONAL,
    teamId: games[0].team_id,
    gameId,
  });
  return { id };
}
