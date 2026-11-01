/**
 * Review Thread Repository - Database operations for proof review threads
 * Spec Reference: Resolution Review & Proof Workflow Implementation
 */

import { randomUUID } from 'crypto';
import { VoteType } from '../shared/types';
import { execute, query, withTransaction } from './connection';
import { refreshLeaderboardEntry } from './leaderboard-repository';
import { removeThreadFiles } from './review-file-repository';
import {
  FileRow,
  getCellInfo,
  getCellInfoForMember,
  loadOpenThread,
  loadThread,
  MessageAndUsernameRow,
  rowToFile,
  rowToMessage,
  rowToThread,
  rowToVote,
  ThreadRow,
  VoteRow,
} from './review-thread-rows';
import type {
  ReviewMessageAndAuthor,
  ReviewThread,
  ReviewThreadWithDetails,
  ReviewVote,
} from './types';

const SELECT_MESSAGE_WITH_AUTHOR = `
  SELECT msg.id, msg.content, u.username
  FROM review_messages msg
  JOIN users u ON msg.author_user_id = u.id
`;

interface ExpiredThreadRow {
  id: string;
  cell_id: string;
  completed_by_user_id: string;
  game_id: string;
  accept_votes: number;
  deny_votes: number;
}

/**
 * Decide how a thread's votes close it.
 * Spec: ≥50% accept → accomplished, <50% → pending
 * @param votes The votes cast so far
 * @param eligibleVoters How many team members may vote
 * @returns The cell's next state, or null while votes are missing or nobody can vote
 */
function decideOutcome(votes: VoteRow[], eligibleVoters: number): 'accomplished' | 'pending' | null {
  // Note: Handle edge case where there are no eligible voters (single-member team)
  if (eligibleVoters === 0 || votes.length < eligibleVoters) {
    return null;
  }

  const acceptVotes = votes.filter((v) => v.vote === 'accept').length;
  return acceptVotes / votes.length >= 0.5 ? 'accomplished' : 'pending';
}

/**
 * Request proof for a completed cell - creates a review thread
 * Spec: Thread Creation - only when resolution is marked completed and proof is requested
 */
export async function requestProof(
  cellId: string,
  requestingUserId: string
): Promise<{ success: boolean; thread?: ReviewThread; error?: string }> {
  // Only team members can request proof
  const access = await getCellInfoForMember(cellId, requestingUserId, 'Only team members can request proof');
  if ('error' in access) {
    return { success: false, error: access.error };
  }

  const { cellInfo } = access;

  // Cannot request proof for own cell
  if (cellInfo.card_user_id === requestingUserId) {
    return { success: false, error: 'Cannot request proof for your own resolution' };
  }

  // Cell must be in completed state
  if (cellInfo.state !== 'completed') {
    return { success: false, error: 'Cell must be completed before requesting proof' };
  }

  // Check if thread already exists for this cell
  const existingThreads = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE cell_id = ? AND status = 'open'`,
    [cellId]
  );

  if (existingThreads.length > 0) {
    return { success: false, error: 'A review thread already exists for this cell' };
  }

  const threadId = randomUUID();

  const cellMoved = await withTransaction(async (connection) => {
    // Create thread
    await connection.execute(
      `INSERT INTO review_threads (id, cell_id, completed_by_user_id, status)
       VALUES (?, ?, ?, 'open')`,
      [threadId, cellId, cellInfo.card_user_id]
    );

    // Optimistic lock: only transition if cell is still in 'completed' state.
    // This prevents races with the owner undoing completion concurrently.
    // Owner actions prevail — if the owner already reverted the cell to
    // 'pending', this UPDATE touches 0 rows and we roll back.
    const updateResult = await execute(
      `UPDATE bingo_cells SET state = 'pending_review' WHERE id = ? AND state = 'completed'`,
      [cellId],
      connection
    );
    return updateResult.affectedRows > 0;
  }, (didMove) => didMove);

  if (!cellMoved) {
    return { success: false, error: 'Cell state changed — the owner may have undone the completion' };
  }

  // Refresh leaderboard: completed → pending_review affects completed_tasks count
  await refreshLeaderboardEntry(cellInfo.game_id, cellInfo.card_user_id);

  const threadRows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE id = ?`,
    [threadId]
  );

  return { success: true, thread: rowToThread(threadRows[0]) };
}

/**
 * Get thread by ID with full details
 */
export async function getThreadById(
  threadId: string,
  requestingUserId: string
): Promise<{ success: boolean; thread?: ReviewThreadWithDetails; error?: string }> {
  const thread = await loadThread(threadId);

  if (!thread) {
    return { success: false, error: 'Thread not found' };
  }

  // Only team members can access thread
  const access = await getCellInfoForMember(thread.cellId, requestingUserId, 'Only team members can access this thread');
  if ('error' in access) {
    return { success: false, error: access.error };
  }

  const { cellInfo } = access;

  // Get messages
  const messages = await query<MessageAndUsernameRow[]>(
    `${SELECT_MESSAGE_WITH_AUTHOR}
     WHERE msg.thread_id = ? ORDER BY msg.created_at ASC`,
    [threadId]
  );

  // Get files
  const fileRows = await query<FileRow[]>(
    `SELECT * FROM review_files WHERE thread_id = ? ORDER BY created_at ASC`,
    [threadId]
  );

  // Get votes
  const voteRows = await query<VoteRow[]>(
    `SELECT * FROM review_votes WHERE thread_id = ? ORDER BY created_at ASC`,
    [threadId]
  );

  return {
    success: true,
    thread: {
      ...thread,
      messages: messages.map(rowToMessage),
      files: fileRows.map(rowToFile),
      votes: voteRows.map(rowToVote),
      cellResolutionText: cellInfo.resolution_text,
      teamId: cellInfo.team_id,
    },
  };
}

/**
 * Add message to thread
 */
export async function addMessage(
  threadId: string,
  authorUserId: string,
  content: string
): Promise<{ success: boolean; message?: ReviewMessageAndAuthor; error?: string }> {
  if (!content || content.trim().length === 0) {
    return { success: false, error: 'Message content is required' };
  }

  const loaded = await loadOpenThread(threadId);
  if ('error' in loaded) {
    return { success: false, error: loaded.error };
  }

  // Only team members can post messages
  const access = await getCellInfoForMember(loaded.thread.cellId, authorUserId, 'Only team members can post messages');
  if ('error' in access) {
    return { success: false, error: access.error };
  }

  const messageId = randomUUID();
  await query(
    `INSERT INTO review_messages (id, thread_id, author_user_id, content)
     VALUES (?, ?, ?, ?)`,
    [messageId, threadId, authorUserId, content.trim()]
  );

  const messageRows = await query<MessageAndUsernameRow[]>(
    `${SELECT_MESSAGE_WITH_AUTHOR}
     WHERE msg.id = ?`,
    [messageId]
  );

  return { success: true, message: rowToMessage(messageRows[0]) };
}

/**
 * Submit or update vote
 * Spec: All team members except completing user must vote
 */
export async function submitVote(
  threadId: string,
  voterUserId: string,
  vote: VoteType
): Promise<{ success: boolean; vote?: ReviewVote; threadClosed?: boolean; error?: string }> {
  const loaded = await loadOpenThread(threadId);
  if ('error' in loaded) {
    return { success: false, error: loaded.error };
  }

  const { thread } = loaded;

  // Only team members can vote
  const access = await getCellInfoForMember(thread.cellId, voterUserId, 'Only team members can vote');
  if ('error' in access) {
    return { success: false, error: access.error };
  }

  const { cellInfo } = access;

  // Completing user cannot vote
  if (thread.completedByUserId === voterUserId) {
    return { success: false, error: 'Completing user cannot vote on their own proof' };
  }

  const { savedVote, nextCellState } = await withTransaction(async (connection) => {
    // Insert or update vote
    const voteId = randomUUID();
    await connection.execute(
      `INSERT INTO review_votes (id, thread_id, voter_user_id, vote)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vote = ?, updated_at = NOW()`,
      [voteId, threadId, voterUserId, vote, vote]
    );

    // Get the actual vote record (in case of update)
    const voteRows = await query<VoteRow[]>(
      `SELECT * FROM review_votes WHERE thread_id = ? AND voter_user_id = ?`,
      [threadId, voterUserId],
      connection
    );

    // Check if all eligible voters have voted
    // Get all team members except the completing user
    const teamMemberRows = await query<Array<{ user_id: string }>>(
      `SELECT user_id FROM team_memberships WHERE team_id = ? AND user_id != ?`,
      [cellInfo.team_id, thread.completedByUserId],
      connection
    );

    const allVoteRows = await query<VoteRow[]>(
      `SELECT * FROM review_votes WHERE thread_id = ?`,
      [threadId],
      connection
    );

    return {
      savedVote: rowToVote(voteRows[0]),
      nextCellState: decideOutcome(allVoteRows, teamMemberRows.length),
    };
  });

  let threadClosed = false;

  if (nextCellState) {
    const closeResult = await finalizeThreadClosure(threadId, thread.cellId, nextCellState);
    threadClosed = closeResult.success;
    if (!closeResult.success) {
      console.error('Failed to close thread after all votes were submitted:', closeResult.error);
    }
  }

  // Refresh persisted leaderboard data after vote-driven state change
  if (threadClosed) {
    await refreshLeaderboardEntry(cellInfo.game_id, thread.completedByUserId);
  }

  return { success: true, vote: savedVote, threadClosed };
}

/**
 * Close thread
 * Spec: When undone, any open review thread is closed and data deleted
 */
export async function closeThread(
  threadId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const loaded = await loadOpenThread(threadId, 'Thread is already closed');
  if ('error' in loaded) {
    return { success: false, error: loaded.error };
  }

  const { thread } = loaded;

  // Get cell info
  const cellInfo = await getCellInfo(thread.cellId);
  if (!cellInfo) {
    return { success: false, error: 'Cell not found' };
  }

  // Only the completing user can close their thread
  if (thread.completedByUserId !== userId) {
    return { success: false, error: 'Only the completing user can close the thread' };
  }

  const closeResult = await finalizeThreadClosure(threadId, thread.cellId, 'pending');
  if (!closeResult.success) {
    return closeResult;
  }

  await refreshLeaderboardEntry(cellInfo.game_id, thread.completedByUserId);

  return { success: true };
}

/**
 * Close every open thread past its 2-day deadline.
 * Spec: 07 - Closure by Deadline
 * @returns The ids of the threads closed, so the caller can signal them
 */
export async function closeExpiredThreads(): Promise<string[]> {
  const threads = await query<ExpiredThreadRow[]>(
    `SELECT rt.id, rt.cell_id, rt.completed_by_user_id, bc.game_id,
            COUNT(CASE WHEN rv.vote = 'accept' THEN 1 END) AS accept_votes,
            COUNT(CASE WHEN rv.vote = 'deny' THEN 1 END) AS deny_votes
     FROM review_threads rt
     JOIN bingo_cells c ON rt.cell_id = c.id
     JOIN bingo_cards bc ON c.card_id = bc.id
     LEFT JOIN review_votes rv ON rv.thread_id = rt.id
     WHERE rt.status = 'open' AND rt.created_at <= NOW() - INTERVAL 2 DAY
     GROUP BY rt.id, rt.cell_id, rt.completed_by_user_id, bc.game_id`
  );

  const closedThreadIds: string[] = [];
  for (const thread of threads) {
    try {
      // Also covers "no votes": 0 >= 0
      const nextCellState = thread.accept_votes >= thread.deny_votes ? 'accomplished' : 'pending';
      const closeResult = await finalizeThreadClosure(thread.id, thread.cell_id, nextCellState);
      if (!closeResult.success) {
        console.error('Failed to close expired thread:', thread.id, closeResult.error);
        continue;
      }
      await refreshLeaderboardEntry(thread.game_id, thread.completed_by_user_id);
      closedThreadIds.push(thread.id);
    } catch (error) {
      console.error('Failed to close expired thread:', thread.id, error);
    }
  }
  return closedThreadIds;
}

async function finalizeThreadClosure(
  threadId: string,
  cellId: string,
  nextCellState: 'pending' | 'accomplished'
): Promise<{ success: boolean; error?: string }> {
  const filesRemoved = await removeThreadFiles(threadId);
  if (!filesRemoved) {
    return { success: false, error: 'Failed to delete uploaded files from storage' };
  }

  return withTransaction<{ success: boolean; error?: string }>(async (connection) => {
    await connection.execute(
      `DELETE FROM review_messages WHERE thread_id = ?`,
      [threadId]
    );

    await connection.execute(
      `UPDATE bingo_cells SET state = ? WHERE id = ? AND state = 'pending_review'`,
      [nextCellState, cellId]
    );

    const updateResult = await execute(
      `UPDATE review_threads SET status = 'closed', closed_at = NOW() WHERE id = ? AND status = 'open'`,
      [threadId],
      connection
    );

    if (updateResult.affectedRows === 0) {
      return { success: false, error: 'Thread is already closed' };
    }

    return { success: true };
  }, (outcome) => outcome.success);
}
