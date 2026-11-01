/**
 * Prepared Resolution Repository - Reads the shared pool and copies entries out of it
 * Spec Reference: 17-prepared-resolutions.md
 */

import type { RowDataPacket } from 'mysql2/promise';
import { PreparedResolutionCategory, ResolutionScope, ResolutionType } from '../shared/types';
import type { PreparedResolution, Subtask } from '../shared/types';
import { query } from './connection';
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

/** Why an entry could not be added to a user's personal resolutions. */
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
 * Add a copy of a pool entry to a user's personal resolutions.
 * Spec: 17-prepared-resolutions.md - Adding to Personal Resolutions
 * @param preparedId The pool entry to copy
 * @param userId The user receiving the copy
 * @returns The id of the copy, or why it was not created
 */
export async function addPreparedResolutionToUser(
  preparedId: string,
  userId: string
): Promise<{ id: string } | { error: AddPreparedResolutionError }> {
  const rows = await query<PreparedResolutionRow[]>(
    `SELECT * FROM prepared_resolutions WHERE id = ?`,
    [preparedId]
  );
  if (rows.length === 0) {
    return { error: 'not_found' };
  }

  const prepared = rowToPreparedResolution(rows[0]);
  const duplicates = await query<RowDataPacket[]>(
    `SELECT id FROM resolutions
     WHERE owner_user_id = ? AND scope = 'personal'
       AND LOWER(COALESCE(description, title)) = LOWER(?)
     LIMIT 1`,
    [userId, prepared.description || prepared.title]
  );
  if (duplicates.length > 0) {
    return { error: 'already_added' };
  }

  const id = await createResolution(userId, preparedResolutionToContent(prepared), {
    scope: ResolutionScope.PERSONAL,
  });
  return { id };
}
