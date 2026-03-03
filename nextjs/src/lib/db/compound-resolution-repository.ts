/**
 * Compound Resolution Repository - Database operations for compound (checklist) resolutions
 * Spec Reference: Resolution Rework — compound type
 */

import { query } from './connection';
import type { CompoundResolutionEntity } from './types';
import type { Subtask } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';

// Row type from database (snake_case)
interface CompoundResolutionRow {
  id: string;
  owner_user_id: string;
  title: string;
  description: string | null;
  subtasks: string; // JSON string from MariaDB
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert a database row to a CompoundResolutionEntity.
 * Parses the JSON subtasks column into a typed array.
 * @param row - The raw database row
 * @returns CompoundResolutionEntity
 */
function rowToEntity(row: CompoundResolutionRow): CompoundResolutionEntity {
  let subtasks: Subtask[];
  try {
    subtasks = typeof row.subtasks === 'string' ? JSON.parse(row.subtasks) : row.subtasks;
  } catch {
    subtasks = [];
  }
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    description: row.description,
    subtasks,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new compound resolution.
 * @param ownerUserId - The owner user ID
 * @param title - Short title (max 255 chars)
 * @param subtasks - Array of subtask objects
 * @param description - Optional longer description
 * @returns The created CompoundResolutionEntity
 */
export async function createCompoundResolution(
  ownerUserId: string,
  title: string,
  subtasks: Subtask[],
  description?: string | null
): Promise<CompoundResolutionEntity> {
  if (!title || title.trim().length === 0) {
    throw new Error('Compound resolution title must be non-empty');
  }
  if (!subtasks || subtasks.length === 0) {
    throw new Error('Compound resolution must have at least one subtask');
  }

  const id = uuidv4();
  const trimmedTitle = title.trim().slice(0, 255);
  const trimmedDesc = description?.trim() || null;
  const subtasksJson = JSON.stringify(subtasks);

  await query(
    `INSERT INTO compound_resolutions (id, owner_user_id, title, description, subtasks)
     VALUES (?, ?, ?, ?, ?)`,
    [id, ownerUserId, trimmedTitle, trimmedDesc, subtasksJson]
  );

  const rows = await query<CompoundResolutionRow[]>(
    `SELECT * FROM compound_resolutions WHERE id = ?`,
    [id]
  );

  return rowToEntity(rows[0]);
}

/**
 * Get all compound resolutions for a user.
 * @param userId - The owner user ID
 * @returns Array of CompoundResolutionEntity
 */
export async function getCompoundResolutionsByUser(
  userId: string
): Promise<CompoundResolutionEntity[]> {
  const rows = await query<CompoundResolutionRow[]>(
    `SELECT * FROM compound_resolutions WHERE owner_user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(rowToEntity);
}

/**
 * Get a compound resolution by ID.
 * @param id - The compound resolution ID
 * @returns CompoundResolutionEntity or null if not found
 */
export async function getCompoundResolutionById(
  id: string
): Promise<CompoundResolutionEntity | null> {
  const rows = await query<CompoundResolutionRow[]>(
    `SELECT * FROM compound_resolutions WHERE id = ?`,
    [id]
  );
  return rows.length > 0 ? rowToEntity(rows[0]) : null;
}

/**
 * Update a compound resolution's metadata (title, description, subtasks).
 * @param id - The compound resolution ID
 * @param ownerUserId - The owner user ID (for authorization)
 * @param updates - Fields to update
 * @returns Updated entity or null if not found/unauthorized
 */
export async function updateCompoundResolution(
  id: string,
  ownerUserId: string,
  updates: { title?: string; description?: string | null; subtasks?: Subtask[] }
): Promise<CompoundResolutionEntity | null> {
  const existing = await getCompoundResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) {
    return null;
  }

  const title = updates.title ? updates.title.trim().slice(0, 255) : existing.title;
  const description = updates.description !== undefined ? (updates.description?.trim() || null) : existing.description;
  const subtasks = updates.subtasks ?? existing.subtasks;

  if (!title) {
    throw new Error('Compound resolution title must be non-empty');
  }
  if (subtasks.length === 0) {
    throw new Error('Compound resolution must have at least one subtask');
  }

  await query(
    `UPDATE compound_resolutions SET title = ?, description = ?, subtasks = ? WHERE id = ? AND owner_user_id = ?`,
    [title, description, JSON.stringify(subtasks), id, ownerUserId]
  );

  return getCompoundResolutionById(id);
}

/**
 * Toggle a specific subtask's completed state.
 * @param id - The compound resolution ID
 * @param ownerUserId - The owner user ID (for authorization)
 * @param subtaskIndex - Zero-based index of the subtask to toggle
 * @returns Updated entity or null if not found/unauthorized
 */
export async function toggleCompoundSubtask(
  id: string,
  ownerUserId: string,
  subtaskIndex: number
): Promise<CompoundResolutionEntity | null> {
  const existing = await getCompoundResolutionById(id);
  if (!existing || existing.ownerUserId !== ownerUserId) {
    return null;
  }

  if (subtaskIndex < 0 || subtaskIndex >= existing.subtasks.length) {
    throw new Error('Subtask index out of range');
  }

  const updatedSubtasks = [...existing.subtasks];
  updatedSubtasks[subtaskIndex] = {
    ...updatedSubtasks[subtaskIndex],
    completed: !updatedSubtasks[subtaskIndex].completed,
  };

  await query(
    `UPDATE compound_resolutions SET subtasks = ? WHERE id = ? AND owner_user_id = ?`,
    [JSON.stringify(updatedSubtasks), id, ownerUserId]
  );

  return getCompoundResolutionById(id);
}

/**
 * Delete a compound resolution.
 * @param id - The compound resolution ID
 * @param ownerUserId - The owner user ID (for authorization)
 * @returns true if deleted, false otherwise
 */
export async function deleteCompoundResolution(
  id: string,
  ownerUserId: string
): Promise<boolean> {
  await query(
    `DELETE FROM compound_resolutions WHERE id = ? AND owner_user_id = ?`,
    [id, ownerUserId]
  );

  const rows = await query<CompoundResolutionRow[]>(
    `SELECT * FROM compound_resolutions WHERE id = ?`,
    [id]
  );

  return rows.length === 0;
}
