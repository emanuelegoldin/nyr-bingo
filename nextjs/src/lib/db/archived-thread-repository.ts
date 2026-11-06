/**
 * Archived Thread Repository - The review threads kept in an archived game
 * Spec Reference: 18-game-archive.md - Archiving a Game, Deleting an Archived Thread
 */

import type { ArchivedThread } from '../shared/types';
import { execute, query, type Executor } from './connection';
import {
  assembleArchivedThreads,
  type ArchivedThreadFileRow,
  type ArchivedThreadMessageRow,
  type ArchivedThreadRow,
} from './archived-thread-rows';
import { getClosedGameThreads } from './closed-thread-repository';
import { deleteStoredFileUnlessShared, type ThreadFilePathRow } from './review-file-repository';

/**
 * Read an ended game's closed threads, ready to be written to its archive.
 * Safe outside the archiving transaction: nothing can change a game once it has ended.
 * @param gameId The ended game
 * @param archivedCellKeys The `userId:position` of every cell that will be archived
 * @returns The threads whose cell is archived
 */
export async function buildThreadSnapshots(gameId: string, archivedCellKeys: Set<string>): Promise<ArchivedThread[]> {
  const threads = await getClosedGameThreads(gameId);
  return threads.filter((thread) => archivedCellKeys.has(`${thread.cardOwnerId}:${thread.cellPosition}`));
}

/**
 * Write a game's closed threads into its archive. Thread and file ids are kept, so a stored file
 * is still recognised as shared.
 * @param archivedGameId The archived game, whose cells are already written
 * @param threads The threads from buildThreadSnapshots
 * @param connection The archiving transaction
 */
export async function saveThreadSnapshots(
  archivedGameId: string,
  threads: ArchivedThread[],
  connection: Executor
): Promise<void> {
  for (const thread of threads) {
    await execute(
      `INSERT INTO archived_threads
         (id, archived_game_id, user_id, position, created_at, closed_at, outcome, accept_votes, deny_votes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        thread.id,
        archivedGameId,
        thread.cardOwnerId,
        thread.cellPosition,
        new Date(thread.createdAt),
        thread.closedAt ? new Date(thread.closedAt) : null,
        thread.outcome,
        thread.acceptVotes,
        thread.denyVotes,
      ],
      connection
    );

    for (const message of thread.messages) {
      await execute(
        `INSERT INTO archived_thread_messages (id, archived_thread_id, author_name, content, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [message.id, thread.id, message.authorName, message.content, new Date(message.createdAt)],
        connection
      );
    }

    for (const file of thread.files) {
      await execute(
        `INSERT INTO archived_thread_files (id, archived_thread_id, file_path, file_name, file_size, mime_type, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [file.id, thread.id, file.filePath, file.fileName, file.fileSize, file.mimeType],
        connection
      );
    }
  }
}

/**
 * List an archived game's threads with their messages and files, most recently closed first.
 * The caller checks that the user may view the archived game (spec 21: archive.view).
 * @param archivedGameId The archived game
 * @returns Its archived threads
 */
export async function getArchivedThreads(archivedGameId: string): Promise<ArchivedThread[]> {
  const [threads, messages, files] = await Promise.all([
    query<ArchivedThreadRow[]>(
      `SELECT t.id, t.user_id AS card_owner_id, p.player_name AS card_owner_name,
              t.position AS cell_position, c.title AS cell_title,
              t.created_at, t.closed_at, t.outcome, t.accept_votes, t.deny_votes
       FROM archived_threads t
       JOIN archived_cells c
         ON c.archived_game_id = t.archived_game_id AND c.user_id = t.user_id AND c.position = t.position
       JOIN archived_game_players p
         ON p.archived_game_id = t.archived_game_id AND p.user_id = t.user_id
       WHERE t.archived_game_id = ?
       ORDER BY t.closed_at DESC, t.created_at DESC`,
      [archivedGameId]
    ),
    query<ArchivedThreadMessageRow[]>(
      `SELECT m.id, m.archived_thread_id AS thread_id, m.author_name, m.content, m.created_at
       FROM archived_thread_messages m
       JOIN archived_threads t ON m.archived_thread_id = t.id
       WHERE t.archived_game_id = ?
       ORDER BY m.created_at ASC`,
      [archivedGameId]
    ),
    query<ArchivedThreadFileRow[]>(
      `SELECT f.id, f.archived_thread_id AS thread_id, f.file_path, f.file_name, f.file_size, f.mime_type
       FROM archived_thread_files f
       JOIN archived_threads t ON f.archived_thread_id = t.id
       WHERE t.archived_game_id = ?
       ORDER BY f.created_at ASC, f.file_name ASC`,
      [archivedGameId]
    ),
  ]);

  return assembleArchivedThreads(threads, messages, files);
}

/**
 * Delete one archived thread: its files leave the disk first, unless another thread shares them,
 * then the thread goes with its messages and file rows.
 * The route checks that the caller ran the game (spec 21: archive.thread.delete).
 * Spec: 18-game-archive.md - Deleting an Archived Thread
 * @param archivedGameId The archived game
 * @param threadId The archived thread
 * @returns Success, or the error and its HTTP status
 */
export async function deleteArchivedThread(
  archivedGameId: string,
  threadId: string
): Promise<{ success: true } | { success: false; error: string; status: 400 | 404 }> {
  const threads = await query<Array<{ id: string }>>(
    `SELECT id FROM archived_threads WHERE id = ? AND archived_game_id = ?`,
    [threadId, archivedGameId]
  );
  if (threads.length === 0) {
    return { success: false, error: 'Archived thread not found', status: 404 };
  }

  const files = await query<ThreadFilePathRow[]>(
    `SELECT id, file_path FROM archived_thread_files WHERE archived_thread_id = ?`,
    [threadId]
  );
  for (const file of files) {
    try {
      await deleteStoredFileUnlessShared(file);
    } catch {
      return { success: false, error: 'Failed to delete uploaded files from storage', status: 400 };
    }
    await execute(`DELETE FROM archived_thread_files WHERE id = ?`, [file.id]);
  }

  await execute(`DELETE FROM archived_threads WHERE id = ?`, [threadId]);
  return { success: true };
}

/**
 * List the files of an archived game's threads, to remove them once the archived game is deleted.
 * @param archivedGameId The archived game
 * @returns The file rows
 */
export async function getArchivedGameThreadFiles(archivedGameId: string): Promise<ThreadFilePathRow[]> {
  return query<ThreadFilePathRow[]>(
    `SELECT f.id, f.file_path
     FROM archived_thread_files f
     JOIN archived_threads t ON f.archived_thread_id = t.id
     WHERE t.archived_game_id = ?`,
    [archivedGameId]
  );
}
