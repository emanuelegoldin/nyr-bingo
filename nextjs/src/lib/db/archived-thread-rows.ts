/**
 * Row types and the mapper that turn closed threads, live or archived, into the shared shape.
 * Internal to lib/db: not exported from the barrel.
 * Spec Reference: 07-proof-and-approval.md - Archived Threads
 */

import type { ArchivedThread, ThreadOutcome } from '../shared/types';

/** A closed thread with its cell and vote counts, from either the live or the archive tables. */
export interface ArchivedThreadRow {
  id: string;
  card_owner_id: string;
  card_owner_name: string;
  cell_position: number;
  cell_title: string;
  created_at: Date;
  closed_at: Date | null;
  outcome: ThreadOutcome | null;
  accept_votes: number | string;
  deny_votes: number | string;
}

/** A message of a closed thread. */
export interface ArchivedThreadMessageRow {
  id: string;
  thread_id: string;
  author_name: string;
  content: string;
  created_at: Date;
}

/** A proof file of a closed thread. */
export interface ArchivedThreadFileRow {
  id: string;
  thread_id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

/**
 * Put each thread together with its messages and files.
 * @param threads The threads, in the order to return them
 * @param messages Their messages, oldest first
 * @param files Their files, oldest first
 * @returns The threads in the shared shape
 */
export function assembleArchivedThreads(
  threads: ArchivedThreadRow[],
  messages: ArchivedThreadMessageRow[],
  files: ArchivedThreadFileRow[]
): ArchivedThread[] {
  return threads.map((row) => ({
    id: row.id,
    cardOwnerId: row.card_owner_id,
    cardOwnerName: row.card_owner_name,
    cellPosition: row.cell_position,
    cellTitle: row.cell_title,
    createdAt: row.created_at.toISOString(),
    closedAt: row.closed_at ? row.closed_at.toISOString() : null,
    outcome: row.outcome,
    // COUNT() comes back as a string from some drivers
    acceptVotes: Number(row.accept_votes),
    denyVotes: Number(row.deny_votes),
    messages: messages
      .filter((message) => message.thread_id === row.id)
      .map((message) => ({
        id: message.id,
        authorName: message.author_name,
        content: message.content,
        createdAt: message.created_at.toISOString(),
      })),
    files: files
      .filter((file) => file.thread_id === row.id)
      .map((file) => ({
        id: file.id,
        fileName: file.file_name,
        filePath: file.file_path,
        fileSize: file.file_size,
        mimeType: file.mime_type,
      })),
  }));
}
