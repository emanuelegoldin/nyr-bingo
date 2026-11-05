/**
 * Row types, mappers and loaders shared by the review thread modules.
 * Internal to lib/db: not exported from the barrel.
 */

import { GameStatus, ThreadStatus, VoteType } from '../shared/types';
import { query } from './connection';
import type {
  ReviewFile,
  ReviewMessageAndAuthor,
  ReviewThread,
  ReviewVote,
} from './types';

/** A refused review action, with the HTTP status to report. Spec: 21-authorization.md - Status Rules */
export type ThreadFailure = { success: false; error: string; status: 400 | 403 | 404 };

// Row types from database
export interface ThreadRow {
  id: string;
  cell_id: string;
  completed_by_user_id: string;
  status: ThreadStatus;
  created_at: Date;
  closed_at: Date | null;
}

export interface MessageAndUsernameRow {
  id: string;
  content: string;
  username: string;
}

export interface FileRow {
  id: string;
  thread_id: string;
  uploaded_by_user_id: string;
  file_path: string;
  file_size: number;
  file_name: string;
  mime_type: string | null;
  created_at: Date;
}

export interface VoteRow {
  id: string;
  thread_id: string;
  voter_user_id: string;
  vote: VoteType;
  created_at: Date;
  updated_at: Date;
}

export interface CellInfoRow {
  cell_id: string;
  card_id: string;
  card_user_id: string;
  game_id: string;
  game_status: GameStatus;
  team_id: string;
  resolution_text: string;
  state: string;
}

// Convert functions
export function rowToThread(row: ThreadRow): ReviewThread {
  return {
    id: row.id,
    cellId: row.cell_id,
    completedByUserId: row.completed_by_user_id,
    status: row.status,
    createdAt: row.created_at,
    closedAt: row.closed_at,
  };
}

export function rowToMessage(row: MessageAndUsernameRow): ReviewMessageAndAuthor {
  return {
    id: row.id,
    authorUsername: row.username,
    content: row.content
  };
}

export function rowToFile(row: FileRow): ReviewFile {
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

export function rowToVote(row: VoteRow): ReviewVote {
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
export async function getCellInfo(cellId: string): Promise<CellInfoRow | null> {
  const rows = await query<CellInfoRow[]>(
    `SELECT
        c.id as cell_id,
        c.card_id,
        CASE
          WHEN c.is_empty THEN 'Empty'
          ELSE COALESCE(c.description, c.title, '')
        END as resolution_text,
        c.state,
        bc.user_id as card_user_id,
        bc.game_id,
        g.status as game_status,
        bc.team_id
     FROM bingo_cells c
     JOIN bingo_cards bc ON c.card_id = bc.id
     JOIN games g ON bc.game_id = g.id
     WHERE c.id = ?`,
    [cellId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Load a thread by ID.
 * @param threadId The thread to load
 * @returns The thread, or null if it does not exist
 */
export async function loadThread(threadId: string): Promise<ReviewThread | null> {
  const rows = await query<ThreadRow[]>(
    `SELECT * FROM review_threads WHERE id = ?`,
    [threadId]
  );
  return rows.length > 0 ? rowToThread(rows[0]) : null;
}

/**
 * Load a thread for an action that requires it to be open.
 * @param threadId The thread to load
 * @param closedError The error to report when the thread is closed
 * @returns The thread, or the error and HTTP status explaining why the action is refused
 */
export async function loadOpenThread(
  threadId: string,
  closedError: string = 'Thread is closed'
): Promise<{ thread: ReviewThread } | { error: string; status: 400 | 404 }> {
  const thread = await loadThread(threadId);

  if (!thread) {
    return { error: 'Thread not found', status: 404 };
  }

  if (thread.status !== 'open') {
    return { error: closedError, status: 400 };
  }

  return { thread };
}
