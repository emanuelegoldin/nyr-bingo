/**
 * Review File Repository - Proof files attached to review threads
 * Spec Reference: Resolution Review & Proof Workflow Implementation
 */

import { randomUUID } from 'crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { query } from './connection';
import { FileRow, loadOpenThread, rowToFile } from './review-thread-rows';
import type { ReviewFile } from './types';

interface ThreadFilePathRow {
  id: string;
  file_path: string;
}

/**
 * Check that a user may upload proof files to a thread.
 * Spec: Only completing user can upload files, and only while the thread is open
 *
 * @param threadId - The thread being uploaded to.
 * @param uploadingUserId - The user uploading the file.
 * @returns An error message, or null when the upload is allowed.
 */
export async function getFileUploadError(
  threadId: string,
  uploadingUserId: string
): Promise<string | null> {
  const loaded = await loadOpenThread(threadId);
  if ('error' in loaded) {
    return loaded.error;
  }
  if (loaded.thread.completedByUserId !== uploadingUserId) {
    return 'Only the completing user can upload proof files';
  }
  return null;
}

/**
 * Upload file to thread
 * Spec: Only completing user can upload files
 */
export async function uploadFile(
  threadId: string,
  uploadingUserId: string,
  filePath: string,
  fileSize: number,
  fileName: string,
  mimeType?: string
): Promise<{ success: boolean; file?: ReviewFile; error?: string }> {
  // Validate file size (max 5MB)
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  if (fileSize > MAX_FILE_SIZE) {
    return { success: false, error: 'File size exceeds 5MB limit' };
  }

  // Repeated here because the thread can close while the route stores the file
  const uploadError = await getFileUploadError(threadId, uploadingUserId);
  if (uploadError) {
    return { success: false, error: uploadError };
  }

  const fileId = randomUUID();
  await query(
    `INSERT INTO review_files (id, thread_id, uploaded_by_user_id, file_path, file_size, file_name, mime_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [fileId, threadId, uploadingUserId, filePath, fileSize, fileName, mimeType || null]
  );

  const fileRows = await query<FileRow[]>(
    `SELECT * FROM review_files WHERE id = ?`,
    [fileId]
  );

  return { success: true, file: rowToFile(fileRows[0]) };
}

/**
 * Delete a previously uploaded file from an open thread
 * Spec: only the completing user can delete a proof file
 */
export async function deleteThreadFile(
  threadId: string,
  deletingUserId: string,
  fileId: string
): Promise<{ success: boolean; error?: string }> {
  const loaded = await loadOpenThread(threadId);
  if ('error' in loaded) {
    return { success: false, error: loaded.error };
  }

  if (loaded.thread.completedByUserId !== deletingUserId) {
    return { success: false, error: 'Only the completing user can delete proof files' };
  }

  const fileRows = await query<ThreadFilePathRow[]>(
    `SELECT id, file_path FROM review_files WHERE id = ? AND thread_id = ?`,
    [fileId, threadId]
  );

  if (fileRows.length === 0) {
    return { success: false, error: 'File not found' };
  }

  const file = fileRows[0];
  await deleteStoredFileUnlessShared(file);

  await query(
    `DELETE FROM review_files WHERE id = ? AND thread_id = ?`,
    [file.id, threadId]
  );

  return { success: true };
}

/**
 * Delete every file of a thread, from storage and then from the database.
 * Stops at the first file that cannot be removed from storage.
 * @param threadId The thread whose files are removed
 * @returns True if all files were removed
 */
export async function removeThreadFiles(threadId: string): Promise<boolean> {
  const fileRows = await query<ThreadFilePathRow[]>(
    `SELECT id, file_path FROM review_files WHERE thread_id = ? ORDER BY created_at ASC`,
    [threadId]
  );

  for (const file of fileRows) {
    try {
      await deleteStoredFileUnlessShared(file);
    } catch {
      return false;
    }

    await query(
      `DELETE FROM review_files WHERE id = ? AND thread_id = ?`,
      [file.id, threadId]
    );
  }

  return true;
}

/**
 * List the proof files of a team's cards, to remove them once the team is deleted.
 * @param teamId The team
 * @returns The file rows
 */
export async function getTeamReviewFiles(teamId: string): Promise<ThreadFilePathRow[]> {
  return query<ThreadFilePathRow[]>(
    `SELECT rf.id, rf.file_path
     FROM review_files rf
     JOIN review_threads rt ON rf.thread_id = rt.id
     JOIN bingo_cells c ON rt.cell_id = c.id
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE bc.team_id = ?`,
    [teamId]
  );
}

/**
 * List the proof files of a game's cards, to remove them once the game is deleted.
 * @param gameId The game
 * @returns The file rows
 */
export async function getGameReviewFiles(gameId: string): Promise<ThreadFilePathRow[]> {
  return query<ThreadFilePathRow[]>(
    `SELECT rf.id, rf.file_path
     FROM review_files rf
     JOIN review_threads rt ON rf.thread_id = rt.id
     JOIN bingo_cells c ON rt.cell_id = c.id
     JOIN bingo_cards bc ON c.card_id = bc.id
     WHERE bc.game_id = ?`,
    [gameId]
  );
}

/**
 * Remove the stored files of rows that were already deleted. Failures are logged and
 * skipped, because the delete they follow has committed.
 * @param files The deleted file rows
 */
export async function removeOrphanedFiles(files: ThreadFilePathRow[]): Promise<void> {
  for (const file of files) {
    try {
      await deleteStoredFileUnlessShared(file);
    } catch (error) {
      console.error('Failed to remove proof file:', file.file_path, error);
    }
  }
}

/**
 * Remove a file from storage unless another row still references it.
 * Names are content-addressed, so identical uploads share one stored file.
 * @param file The file row being deleted
 */
async function deleteStoredFileUnlessShared(file: ThreadFilePathRow): Promise<void> {
  const otherReferences = await query<Array<{ id: string }>>(
    `SELECT id FROM review_files WHERE file_path = ? AND id != ? LIMIT 1`,
    [file.file_path, file.id]
  );

  if (otherReferences.length === 0) {
    await deleteStoredThreadFile(file.file_path);
  }
}

// Based on possible alias, retrieve actual path on filesystem
function resolveThreadFileLocation(filePath: string): string | null {
  const normalized = path.posix.normalize((filePath || '').replace(/^\/+/, ''));

  if (normalized.startsWith('review-files/')) {
    return path.join(process.cwd(), 'uploads', normalized);
  }

  if (normalized.startsWith('uploads/review-files/')) {
    return path.join(process.cwd(), 'public', normalized);
  }

  return null;
}

async function deleteStoredThreadFile(filePath: string): Promise<void> {
  const fileLocation = resolveThreadFileLocation(filePath);
  if (!fileLocation) {
    throw new Error(`Refusing to delete unexpected file path: ${filePath}`);
  }

  try {
    await rm(fileLocation);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
}
