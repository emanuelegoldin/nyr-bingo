/**
 * Closed Thread Repository - The archived threads of a running game: reading and deleting them
 * Spec Reference: 07-proof-and-approval.md - Archived Threads
 */

import type { ArchivedThread } from '../shared/types';
import { execute, query } from './connection';
import {
  assembleArchivedThreads,
  type ArchivedThreadFileRow,
  type ArchivedThreadMessageRow,
  type ArchivedThreadRow,
} from './archived-thread-rows';
import { removeThreadFiles } from './review-file-repository';
import { loadThread, type ThreadFailure } from './review-thread-rows';

/**
 * List a game's closed threads with their messages and files, most recently closed first.
 * The caller checks that the user may view the game (spec 21: thread.view).
 * @param gameId The game
 * @returns The game's archived threads
 */
export async function getClosedGameThreads(gameId: string): Promise<ArchivedThread[]> {
  const [threads, messages, files] = await Promise.all([
    query<ArchivedThreadRow[]>(
      `SELECT rt.id, bc.user_id AS card_owner_id, u.username AS card_owner_name,
              c.position AS cell_position, COALESCE(c.title, c.description, '') AS cell_title,
              rt.created_at, rt.closed_at, rt.outcome,
              COUNT(CASE WHEN rv.vote = 'accept' THEN 1 END) AS accept_votes,
              COUNT(CASE WHEN rv.vote = 'deny' THEN 1 END) AS deny_votes
       FROM review_threads rt
       JOIN bingo_cells c ON rt.cell_id = c.id
       JOIN bingo_cards bc ON c.card_id = bc.id
       JOIN users u ON bc.user_id = u.id
       LEFT JOIN review_votes rv ON rv.thread_id = rt.id
       WHERE bc.game_id = ? AND rt.status = 'closed'
       GROUP BY rt.id, bc.user_id, u.username, c.position, c.title, c.description,
                rt.created_at, rt.closed_at, rt.outcome
       ORDER BY rt.closed_at DESC, rt.created_at DESC`,
      [gameId]
    ),
    query<ArchivedThreadMessageRow[]>(
      `SELECT msg.id, msg.thread_id, u.username AS author_name, msg.content, msg.created_at
       FROM review_messages msg
       JOIN users u ON msg.author_user_id = u.id
       JOIN review_threads rt ON msg.thread_id = rt.id
       JOIN bingo_cells c ON rt.cell_id = c.id
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE bc.game_id = ? AND rt.status = 'closed'
       ORDER BY msg.created_at ASC`,
      [gameId]
    ),
    query<ArchivedThreadFileRow[]>(
      `SELECT rf.id, rf.thread_id, rf.file_path, rf.file_name, rf.file_size, rf.mime_type
       FROM review_files rf
       JOIN review_threads rt ON rf.thread_id = rt.id
       JOIN bingo_cells c ON rt.cell_id = c.id
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE bc.game_id = ? AND rt.status = 'closed'
       ORDER BY rf.created_at ASC`,
      [gameId]
    ),
  ]);

  return assembleArchivedThreads(threads, messages, files);
}

/**
 * Delete a closed thread: its files leave the disk first, then the thread goes with its
 * messages, file rows and votes. The cell is not changed.
 * The route checks that the caller is an admin of the game (spec 21: thread.delete).
 * Spec: 07-proof-and-approval.md - Deleting an Archived Thread
 * @param threadId The thread
 * @returns Success, or the error and its HTTP status
 */
export async function deleteClosedThread(threadId: string): Promise<{ success: true } | ThreadFailure> {
  const thread = await loadThread(threadId);
  if (!thread) {
    return { success: false, error: 'Thread not found', status: 404 };
  }
  if (thread.status === 'open') {
    return { success: false, error: 'An open thread cannot be deleted', status: 400 };
  }

  // Storage cannot roll back, so files go first; the thread stays if one cannot be removed
  if (!(await removeThreadFiles(threadId))) {
    return { success: false, error: 'Failed to delete uploaded files from storage', status: 400 };
  }

  await execute(`DELETE FROM review_threads WHERE id = ? AND status = 'closed'`, [threadId]);
  return { success: true };
}
