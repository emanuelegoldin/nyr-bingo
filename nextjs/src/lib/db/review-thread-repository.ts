/**
 * Review Thread Repository - Database operations for proof review threads
 * Spec Reference: Resolution Review & Proof Workflow Implementation
 */

import { query, getConnection } from './connection';
import type {
  ReviewThread,
  ReviewMessageAndAuthor,
  ReviewFile,
  ReviewVote,
  ReviewThreadWithDetails,
} from './types';
import { randomUUID } from 'crypto';
import { isTeamMember } from './team-repository';
import { refreshLeaderboardEntry } from './leaderboard-repository';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { PoolConnection } from 'mysql2/promise';
import { ThreadStatus, VoteType } from '../shared/types';

// Row types from database
interface ThreadRow {
  id: string;
  cell_id: string;
  completed_by_user_id: string;
  status: ThreadStatus;
  created_at: Date;
  closed_at: Date | null;
}

interface MessageAndUsernameRow {
  id: string;
  content: string;
  username: string;
}

interface FileRow {
  id: string;
  thread_id: string;
  uploaded_by_user_id: string;
  file_path: string;
  file_size: number;
  file_name: string;
  mime_type: string | null;
  created_at: Date;
}

interface VoteRow {
  id: string;
  thread_id: string;
  voter_user_id: string;
  vote: VoteType;
  created_at: Date;
  updated_at: Date;
}

interface CellInfoRow {
  cell_id: string;
  card_id: string;
  card_user_id: string;
  team_id: string;
  resolution_text: string;
  state: string;
}

// Convert functions
function rowToThread(row: ThreadRow): ReviewThread {
  return {
    id: row.id,
    cellId: row.cell_id,
    completedByUserId: row.completed_by_user_id,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

function rowToMessage(row: MessageAndUsernameRow): ReviewMessageAndAuthor {
  return {
    id: row.id,
    authorUsername: row.username,
    content: row.content
  };
}

function rowToFile(row: FileRow): ReviewFile {
  return {
    id: row.id,
    threadId: row.thread_id,
    uploadedByUserId: row.uploaded_by_user_id,
    filePath: row.file_path,
    fileSize: row.file_size,
    fileName: row.file_name,
    mimeType: row.mime_type,
    createdAt: row.created_at,
  };
}

function rowToVote(row: VoteRow): ReviewVote {
  return {
    id: row.id,
    threadId: row.thread_id,
    voterUserId: row.voter_user_id,
    vote: row.vote,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Get cell and team information
 */
async function getCellInfo(cellId: string): Promise<CellInfoRow | null> {
  const rows = await query<CellInfoRow[]>(
    `SELECT
        c.id as cell_id,
        c.card_id,
        CASE
          WHEN c.is_empty THEN 'Empty'
          WHEN c.resolution_id IS NOT NULL THEN COALESCE(r.description, r.title, '')
          ELSE ''
        END as resolution_text,
        c.state,
        bc.user_id as card_user_id,
        bc.team_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     LEFT JOIN resolutions r ON c.resolution_id = r.id
     WHERE c.id = ?`,
    [cellId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Request proof for a completed cell - creates a review thread
 * Spec: Thread Creation - only when resolution is marked completed and proof is requested
 */
export async function requestProof(
  cellId: string,
  requestingUserId: string
): Promise<{ success: boolean; thread?: ReviewThread; error?: string }> {
  const cellInfo = await getCellInfo(cellId);

  if (!cellInfo) {
    return { success: false, error: 'Cell not found' };
  }

  // Only team members can request proof
  const isMember = await isTeamMember(cellInfo.team_id, requestingUserId);
  if (!isMember) {
    return { success: false, error: 'Only team members can request proof' };
  }

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

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Create thread
    const threadId = randomUUID();
    await connection.execute(
      `INSERT INTO review_threads (id, cell_id, completed_by_user_id, status)
       VALUES (?, ?, ?, 'open')`,
      [threadId, cellId, cellInfo.card_user_id]
    );

    // Optimistic lock: only transition if cell is still in 'completed' state.
    // This prevents races with the owner undoing completion concurrently.
    // Owner actions prevail — if the owner already reverted the cell to
    // 'pending', this UPDATE touches 0 rows and we roll back.
    const [updateResult] = await connection.execute(
      `UPDATE bingo_cells SET state = 'pending_review' WHERE id = ? AND state = 'completed'`,
      [cellId]
    );
    const affectedRows = (updateResult as { affectedRows: number }).affectedRows;
    if (affectedRows === 0) {
      await connection.rollback();
      return { success: false, error: 'Cell state changed — the owner may have undone the completion' };
    }

    await connection.commit();

    // Refresh leaderboard: completed → pending_review affects completed_tasks count
    await refreshLeaderboardEntry(cellInfo.team_id, cellInfo.card_user_id);

    const threadRows = await query<ThreadRow[]>(
      `SELECT * FROM review_threads WHERE id = ?`,
      [threadId]
    );

    return { success: true, thread: rowToThread(threadRows[0]) };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get thread by ID with full details
 */
export async function getThreadById(
  threadId: string,
  requestingUserId: string
): Promise<{ success: boolean; thread?: ReviewThreadWithDetails; error?: string }> {
  const threadRows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE id = ?`,
    [threadId]
  );

  if (threadRows.length === 0) {
    return { success: false, error: 'Thread not found' };
  }

  const thread = rowToThread(threadRows[0]);

  // Get cell info to check team membership
  const cellInfo = await getCellInfo(thread.cellId);
  if (!cellInfo) {
    return { success: false, error: 'Cell not found' };
  }

  // Only team members can access thread
  const isMember = await isTeamMember(cellInfo.team_id, requestingUserId);
  if (!isMember) {
    return { success: false, error: 'Only team members can access this thread' };
  }

  // Get messages
  const messages = await query<MessageAndUsernameRow[]>(
    `SELECT msg.id, msg.content, u.username 
    FROM review_messages msg 
    JOIN users u ON msg.author_user_id = u.id
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

  const threadRows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE id = ?`,
    [threadId]
  );

  if (threadRows.length === 0) {
    return { success: false, error: 'Thread not found' };
  }

  const thread = rowToThread(threadRows[0]);

  if (thread.status !== 'open') {
    return { success: false, error: 'Thread is closed' };
  }

  // Get cell info to check team membership
  const cellInfo = await getCellInfo(thread.cellId);
  if (!cellInfo) {
    return { success: false, error: 'Cell not found' };
  }

  // Only team members can post messages
  const isMember = await isTeamMember(cellInfo.team_id, authorUserId);
  if (!isMember) {
    return { success: false, error: 'Only team members can post messages' };
  }

  const messageId = randomUUID();
  await query(
    `INSERT INTO review_messages (id, thread_id, author_user_id, content)
     VALUES (?, ?, ?, ?)`,
    [messageId, threadId, authorUserId, content.trim()]
  );

  const messageRows = await query<MessageAndUsernameRow[]>(
    `SELECT msg.id, msg.content, u.username
     FROM review_messages msg
     JOIN users u ON msg.author_user_id = u.id
     WHERE msg.id = ?`,
    [messageId]
  );

  return { success: true, message: rowToMessage(messageRows[0]) };
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

  const threadRows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE id = ?`,
    [threadId]
  );

  if (threadRows.length === 0) {
    return { success: false, error: 'Thread not found' };
  }

  const thread = rowToThread(threadRows[0]);

  if (thread.status !== 'open') {
    return { success: false, error: 'Thread is closed' };
  }

  // Only the completing user can upload files
  if (thread.completedByUserId !== uploadingUserId) {
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
 * Submit or update vote
 * Spec: All team members except completing user must vote
 */
export async function submitVote(
  threadId: string,
  voterUserId: string,
  vote: VoteType
): Promise<{ success: boolean; vote?: ReviewVote; threadClosed?: boolean; error?: string }> {
  const threadRows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE id = ?`,
    [threadId]
  );

  if (threadRows.length === 0) {
    return { success: false, error: 'Thread not found' };
  }

  const thread = rowToThread(threadRows[0]);

  if (thread.status !== 'open') {
    return { success: false, error: 'Thread is closed' };
  }

  // Get cell info
  const cellInfo = await getCellInfo(thread.cellId);
  if (!cellInfo) {
    return { success: false, error: 'Cell not found' };
  }

  // Only team members can vote
  const isMember = await isTeamMember(cellInfo.team_id, voterUserId);
  if (!isMember) {
    return { success: false, error: 'Only team members can vote' };
  }

  // Completing user cannot vote
  if (thread.completedByUserId === voterUserId) {
    return { success: false, error: 'Completing user cannot vote on their own proof' };
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Insert or update vote
    const voteId = randomUUID();
    await connection.execute(
      `INSERT INTO review_votes (id, thread_id, voter_user_id, vote)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE vote = ?, updated_at = NOW()`,
      [voteId, threadId, voterUserId, vote, vote]
    );

    // Get the actual vote record (in case of update)
    const [voteRowsUnknown] = await connection.execute(
      `SELECT * FROM review_votes WHERE thread_id = ? AND voter_user_id = ?`,
      [threadId, voterUserId]
    );

    const voteRows = voteRowsUnknown as VoteRow[];
    const savedVote = rowToVote(voteRows[0]);

    // Check if all eligible voters have voted
    // Get all team members except the completing user
    const [teamMemberRowsUnknown] = await connection.execute(
      `SELECT user_id FROM team_memberships WHERE team_id = ? AND user_id != ?`,
      [cellInfo.team_id, thread.completedByUserId]
    );

    const teamMemberRows = teamMemberRowsUnknown as Array<{ user_id: string }>;

    const eligibleVoters = teamMemberRows.length;

    const [allVoteRowsUnknown] = await connection.execute(
      `SELECT * FROM review_votes WHERE thread_id = ?`,
      [threadId]
    );

    const allVoteRows = allVoteRowsUnknown as VoteRow[];

    const totalVotes = allVoteRows.length;

    let threadClosed = false;

    // If all eligible voters have voted, close the thread
    // Note: Handle edge case where there are no eligible voters (single-member team)
    let fileRows: {file_path: string}[] = []
    if (eligibleVoters > 0 && totalVotes >= eligibleVoters) {
      // Count accept votes
      const acceptVotes = allVoteRows.filter((v: VoteRow) => v.vote === 'accept').length;
      const acceptPercentage = acceptVotes / totalVotes;

      // Determine new cell state based on votes
      // Spec: ≥50% accept → accomplished, <50% → pending
      const newState = acceptPercentage >= 0.5 ? 'accomplished' : 'pending';

      
      // Update cell state
      await connection.execute(
        `UPDATE bingo_cells SET state = ? WHERE id = ?`,
        [newState, thread.cellId]
      );

      // Close thread
      await connection.execute(
        `UPDATE review_threads SET status = 'closed', closed_at = NOW() WHERE id = ?`,
        [threadId]
      );
      threadClosed = true;

      // Delete messages
      await cleanUpThreadMessages(threadId, connection);
      // Get filepaths (use the same connection/transaction and destructure the row result)
      const [fileRowsResult] = await connection.execute(
        `SELECT file_path FROM review_files WHERE thread_id = ?`,
        [threadId]
      );
      fileRows = fileRowsResult as { file_path: string }[];

      // Delete file records from database
      await connection.execute(
        `DELETE FROM review_files WHERE thread_id = ?`,
        [threadId]
      );
    }

    await connection.commit();
    await deleteThreadFiles(fileRows)

    // Refresh persisted leaderboard data after vote-driven state change
    if (threadClosed) {
      await refreshLeaderboardEntry(cellInfo.team_id, thread.completedByUserId);
    }

    return { success: true, vote: savedVote, threadClosed };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Close thread (e.g., when user undoes completion)
 * Spec: When undone, any open review thread is closed and data deleted
 */
export async function closeThread(
  threadId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const threadRows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE id = ?`,
    [threadId]
  );

  if (threadRows.length === 0) {
    return { success: false, error: 'Thread not found' };
  }

  const thread = rowToThread(threadRows[0]);

  // Get cell info
  const cellInfo = await getCellInfo(thread.cellId);
  if (!cellInfo) {
    return { success: false, error: 'Cell not found' };
  }

  // Only the completing user can close their thread
  if (thread.completedByUserId !== userId) {
    return { success: false, error: 'Only the completing user can close the thread' };
  }

  const connection = await getConnection();

  try {
    await connection.beginTransaction();

    // Delete messages
    await cleanUpThreadMessages(threadId, connection);

    // Get filepaths
    const [fileRowsResult] = await connection.execute(
        `SELECT file_path FROM review_files WHERE thread_id = ?`,
        [threadId]
      );
    const fileRows = fileRowsResult as { file_path: string }[];

     // Delete file records from database
    await connection.execute(
      `DELETE FROM review_files WHERE thread_id = ?`,
      [threadId]
    );

  
    // Close thread
    await connection.execute(
      `UPDATE review_threads SET status = 'closed', closed_at = NOW() WHERE id = ?`,
      [threadId]
    );
  
    await connection.commit();
    await deleteThreadFiles(fileRows);

    return { success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Get open thread for a cell
 */
export async function getOpenThreadForCell(cellId: string): Promise<ReviewThread | null> {
  const rows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE cell_id = ? AND status = 'open'`,
    [cellId]
  );

  return rows.length > 0 ? rowToThread(rows[0]) : null;
}

async function cleanUpThreadMessages(threadId: string, connection: PoolConnection): Promise<void> {
  connection.execute(
    `DELETE FROM review_messages WHERE thread_id = ?`,
    [threadId]
  );
}

async function deleteThreadFiles(fileRows: {file_path: string}[]): Promise<void> {
  for (const file of fileRows) {
    try {
      // Stored as a public URL like "/uploads/review-files/<name>".
      const publicRelativePath = path.normalize((file.file_path || '').replace(/^\/+/, ''));
      
      // Safety: only allow deleting from uploads/review-files.
      if (!publicRelativePath.startsWith('uploads/review-files/')) {
        console.error(
          'Refusing to delete unexpected file path:',
          file.file_path
        );
        continue;
      }

      const fileLocation = path.join(process.cwd(), 'public', publicRelativePath);
      await rm(fileLocation, { force: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('Error deleting file from storage:', error);
        continue;
      }
      throw error;
    }
  }
}