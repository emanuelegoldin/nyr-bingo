/**
 * Cell History Repository
 * Spec Reference: 13-resolution-history-and-progress.md
 *
 * Stores and retrieves the history of a bingo cell: manual notes by the card owner and
 * system events for progress changes.
 */

import type { RowDataPacket } from 'mysql2/promise';
import { v4 as uuidv4 } from 'uuid';
import { query } from './connection';
import type {
  ResolutionHistoryEntry,
  ResolutionHistoryEntryType,
} from './types';

interface CellHistoryEntryRow extends RowDataPacket {
  id: string;
  cell_id: string;
  author_user_id: string;
  author_username: string;
  entry_type: ResolutionHistoryEntryType;
  event_key: string | null;
  content: string;
  metadata_json: string | Record<string, unknown> | null;
  created_at: Date;
}

const SELECT_ENTRY = `
  SELECT
    che.id,
    che.cell_id,
    che.author_user_id,
    u.username AS author_username,
    che.entry_type,
    che.event_key,
    che.content,
    che.metadata_json,
    che.created_at
  FROM cell_history_entries che
  JOIN users u ON u.id = che.author_user_id
`;

/**
 * Read a metadata column, which the driver may return as JSON text.
 * @param metadata The column value
 * @returns The metadata object, or null when absent or unreadable
 */
function parseMetadata(metadata: string | Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata) return null;
  if (typeof metadata === 'string') {
    try {
      return JSON.parse(metadata) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return metadata;
}

/**
 * Convert a database row into a history entry.
 * @param row The row
 * @returns The entry
 */
function rowToHistoryEntry(row: CellHistoryEntryRow): ResolutionHistoryEntry {
  return {
    id: row.id,
    cellId: row.cell_id,
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    entryType: row.entry_type,
    eventKey: row.event_key,
    content: row.content,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
  };
}

/**
 * Truncate a number to an integer, or use a fallback when it is not finite.
 * @param value The number
 * @param fallback The value to use instead of NaN or infinity
 * @returns An integer
 */
function toSafeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.trunc(value);
}

/**
 * List a cell's history, newest first.
 * @param cellId The cell
 * @param limit How many entries to return, between 1 and 100
 * @param offset How many entries to skip
 * @returns The entries
 */
export async function getCellHistoryEntries(
  cellId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<ResolutionHistoryEntry[]> {
  const safeLimit = Math.max(1, Math.min(100, toSafeInteger(limit, 50)));
  const safeOffset = Math.max(0, toSafeInteger(offset, 0));

  const rows = await query<CellHistoryEntryRow[]>(
    `${SELECT_ENTRY}
     WHERE che.cell_id = ?
     ORDER BY che.created_at DESC
     LIMIT ? OFFSET ?`,
    [cellId, safeLimit, safeOffset],
  );

  return rows.map(rowToHistoryEntry);
}

interface CreateCellHistoryEntryInput {
  cellId: string;
  authorUserId: string;
  entryType: ResolutionHistoryEntryType;
  content: string;
  eventKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Store a history entry on a cell.
 * @param input The entry
 * @returns The stored entry
 */
async function createCellHistoryEntry(
  input: CreateCellHistoryEntryInput,
): Promise<ResolutionHistoryEntry> {
  const trimmedContent = input.content.trim();
  if (!trimmedContent) {
    throw new Error('History content must be non-empty');
  }

  const id = uuidv4();
  await query(
    `INSERT INTO cell_history_entries
      (id, cell_id, author_user_id, entry_type, event_key, content, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.cellId,
      input.authorUserId,
      input.entryType,
      input.eventKey ?? null,
      trimmedContent,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );

  const rows = await query<CellHistoryEntryRow[]>(
    `${SELECT_ENTRY}
     WHERE che.id = ?
     LIMIT 1`,
    [id],
  );

  if (rows.length === 0) {
    throw new Error('Failed to create history entry');
  }

  return rowToHistoryEntry(rows[0]);
}

/**
 * Add a manual note to a cell's history. The route checks that the author owns the card.
 * @param cellId The cell
 * @param authorUserId The card owner
 * @param content The note
 * @returns The stored entry
 */
export async function createManualCellHistoryEntry(
  cellId: string,
  authorUserId: string,
  content: string,
): Promise<ResolutionHistoryEntry> {
  return createCellHistoryEntry({
    cellId,
    authorUserId,
    entryType: 'manual_note',
    content,
  });
}

/**
 * Record a system event in a cell's history.
 * Logging failures are swallowed so they never undo the change being recorded.
 * @param cellId The cell the event belongs to
 * @param authorUserId The user who triggered the event
 * @param eventKey The event's identifier
 * @param content The human-readable description
 * @param metadata Optional structured details
 */
export async function logCellHistoryEventSafe(
  cellId: string,
  authorUserId: string,
  eventKey: string,
  content: string,
  metadata?: Record<string, unknown> | null,
): Promise<void> {
  try {
    await createCellHistoryEntry({
      cellId,
      authorUserId,
      entryType: 'system_event',
      eventKey,
      content,
      metadata,
    });
  } catch {
    // Preserve the core change even if history logging fails.
  }
}
