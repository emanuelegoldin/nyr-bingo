/**
 * Iterative Resolution Repository - Database operations for iterative (counter) resolutions
 * Spec Reference: Resolution Rework — iterative type
 */

import { query } from './connection';
import type { IterativeResolutionEntity } from './types';
import { v4 as uuidv4 } from 'uuid';

// Row type from database (snake_case)
interface IterativeResolutionRow {
  id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  number_of_repetition: number;
  completed_times: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert a database row to an IterativeResolutionEntity.
 * @param row - The raw database row
 * @returns IterativeResolutionEntity
 */
function rowToEntity(row: IterativeResolutionRow): IterativeResolutionEntity {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    numberOfRepetition: row.number_of_repetition,
    completedTimes: row.completed_times,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new iterative resolution.
 * @param ownerUserId - The owner user ID
 * @param title - Short title (max 255 chars)
 * @param numberOfRepetition - Target number of times the action should be performed
 * @param description - Optional longer description
 * @returns The created IterativeResolutionEntity
 */
export async function createIterativeResolution(
  ownerUserId: string,
  title: string,
  numberOfRepetition: number,
  description?: string | null
): Promise<IterativeResolutionEntity> {
  if (!title || title.trim().length === 0) {
    throw new Error('Iterative resolution title must be non-empty');
  }
  if (numberOfRepetition < 1) {
    throw new Error('Number of repetitions must be at least 1');
  }

  const id = uuidv4();
  const trimmedTitle = title.trim().slice(0, 255);
  const trimmedDesc = description?.trim() || null;

  await query(
    `INSERT INTO iterative_resolutions (id, owner_user_id, title, description, number_of_repetition, completed_times)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [id, ownerUserId, trimmedTitle, trimmedDesc, numberOfRepetition]
  );

  const rows = await query<IterativeResolutionRow[]>(
    `SELECT * FROM iterative_resolutions WHERE id = ?`,
    [id]
  );

  return rowToEntity(rows[0]);
}

/**
 * Get all iterative resolutions for a user.
 * @param userId - The owner user ID
 * @returns Array of IterativeResolutionEntity
 */
export async function getIterativeResolutionsByUser(
  userId: string
): Promise<IterativeResolutionEntity[]> {
  const rows = await query<IterativeResolutionRow[]>(
    `SELECT * FROM iterative_resolutions WHERE owner_user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(rowToEntity);
}

/**
 * Get an iterative resolution by ID.
 * @param id - The iterative resolution ID
 * @returns IterativeResolutionEntity or null if not found
 */
export async function getIterativeResolutionById(
  id: string
): Promise<IterativeResolutionEntity | null> {
  const rows = await query<IterativeResolutionRow[]>(
    `SELECT * FROM iterative_resolutions WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? rowToEntity(rows[0]) : null;
}

/**
 * Update an iterative resolution's metadata (title, description, numberOfRepetition).
 * @param id - The iterative resolution ID
 * @param ownerUserId - The owner user ID (for authorization)
 * @param updates - Fields to update
 * @returns Updated entity or null if not found/unauthorized
 */
export async function updateIterativeResolution(
  id: string,
  ownerUserId: string,
  updates: { title?: string; description?: string | null; numberOfRepetition?: number }
): Promise<IterativeResolutionEntity | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) {
    return null;
  }

  const title = updates.title ? updates.title.trim().slice(0, 255) : existing.title;
  const description = updates.description !== undefined ? (updates.description?.trim() || null) : existing.description;
  const numberOfRepetition = updates.numberOfRepetition ?? existing.numberOfRepetition;

  if (!title) {
    throw new Error('Iterative resolution title must be non-empty');
  }
  if (numberOfRepetition < 1) {
    throw new Error('Number of repetitions must be at least 1');
  }

  await query(
    `UPDATE iterative_resolutions SET title = ?, description = ?, number_of_repetition = ? WHERE id = ? AND owner_user_id = ?`,
    [title, description, numberOfRepetition, id, ownerUserId]
  );

  return getIterativeResolutionById(id);
}

/**
 * Increment the completed_times counter by 1.
 * @param id - The iterative resolution ID
 * @param ownerUserId - The owner user ID (for authorization)
 * @returns Updated entity or null if not found/unauthorized
 */
export async function incrementIterativeResolution(
  id: string,
  ownerUserId: string
): Promise<IterativeResolutionEntity | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) {
    return null;
  }

  await query(
    `UPDATE iterative_resolutions SET completed_times = completed_times + 1 WHERE id = ? AND owner_user_id = ?`,
    [id, ownerUserId]
  );

  return getIterativeResolutionById(id);
}

/**
 * Decrement the completed_times counter by 1 (minimum 0).
 * @param id - The iterative resolution ID
 * @param ownerUserId - The owner user ID (for authorization)
 * @returns Updated entity or null if not found/unauthorized
 */
export async function decrementIterativeResolution(
  id: string,
  ownerUserId: string
): Promise<IterativeResolutionEntity | null> {
  const existing = await getIterativeResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) {
    return null;
  }

  await query(
    `UPDATE iterative_resolutions SET completed_times = GREATEST(completed_times - 1, 0) WHERE id = ? AND owner_user_id = ?`,
    [id, ownerUserId]
  );

  return getIterativeResolutionById(id);
}

/**
 * Delete an iterative resolution.
 * @param id - The iterative resolution ID
 * @param ownerUserId - The owner user ID (for authorization)
 * @returns true if deleted, false otherwise
 */
export async function deleteIterativeResolution(
  id: string,
  ownerUserId: string
): Promise<boolean> {
  await query(
    `DELETE FROM iterative_resolutions WHERE id = ? AND owner_user_id = ?`,
    [id, ownerUserId]
  );

  const rows = await query<IterativeResolutionRow[]>(
    `SELECT * FROM iterative_resolutions WHERE id = ?`,
    [id]
  );

  return rows.length === 0;
}
