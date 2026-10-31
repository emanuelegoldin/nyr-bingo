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

  const loaded = await loadOpenThread(threadId);
  if ('error' in loaded) {
    return { success: false, error: loaded.error };
  }

  // Only the completing user can upload files
  if (loaded.thread.completedByUserId !== uploadingUserId) {
    return { success: false, error: 'Only the completing user can upload proof files' };
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
  await deleteStoredThreadFile(file.file_path);

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
      await deleteStoredThreadFile(file.file_path);
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
