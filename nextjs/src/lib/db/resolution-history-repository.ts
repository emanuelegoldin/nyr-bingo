/**
 * Resolution History Repository
 *
 * Stores and retrieves resolution history entries (manual notes + system events)
 * and centralizes visibility/write authorization checks.
 */

import { query } from './connection';
import type {
  Resolution,
  ResolutionHistoryAccess,
  ResolutionHistoryEntry,
  ResolutionHistoryEntryType,
} from './types';
import { getResolutionById } from './resolution-repository';
import { isTeamMember } from './team-repository';
import { ResolutionScope, ResolutionType } from '../shared/types';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';

interface ResolutionHistoryEntryRow extends RowDataPacket {
  id: string;
  resolution_id: string;
  author_user_id: string;
  author_username: string;
  entry_type: ResolutionHistoryEntryType;
  event_key: string | null;
  content: string;
  metadata_json: string | Record<string, unknown> | null;
  created_at: Date;
}

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

function rowToResolutionHistoryEntry(row: ResolutionHistoryEntryRow): ResolutionHistoryEntry {
  return {
    id: row.id,
    resolutionId: row.resolution_id,
    authorUserId: row.author_user_id,
    authorUsername: row.author_username,
    entryType: row.entry_type,
    eventKey: row.event_key,
    content: row.content,
    metadata: parseMetadata(row.metadata_json),
    createdAt: row.created_at,
  };
}

function toSafeInteger(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.trunc(value);
}

async function canViewPersonalResolutionViaTeamCards(
  resolutionId: string,
  requestingUserId: string,
): Promise<boolean> {
  const rows = await query<Array<{ visible: number }>>(
    `SELECT 1 AS visible
     FROM bingo_cells c
     JOIN bingo_cards bc ON bc.id = c.card_id
     JOIN team_memberships tm ON tm.team_id = bc.team_id
     WHERE c.resolution_id = ? AND tm.user_id = ?
     LIMIT 1`,
    [resolutionId, requestingUserId],
  );

  return rows.length > 0;
}

async function computeReadAccess(
  resolution: Resolution,
  requestingUserId: string,
): Promise<boolean> {
  if (resolution.ownerUserId === requestingUserId) {
    return true;
  }

  if (resolution.scope === ResolutionScope.TEAM || resolution.scope === ResolutionScope.MEMBER_PROVIDED) {
    if (!resolution.teamId) return false;
    return isTeamMember(resolution.teamId, requestingUserId);
  }

  if (resolution.scope === ResolutionScope.PERSONAL) {
    return canViewPersonalResolutionViaTeamCards(resolution.id, requestingUserId);
  }

  return false;
}

export async function getResolutionHistoryAccess(
  resolutionId: string,
  requestingUserId: string,
): Promise<ResolutionHistoryAccess> {
  const resolution = await getResolutionById(resolutionId);
  if (!resolution) {
    return {
      resolution: null,
      canView: false,
      canWrite: false,
    };
  }

  if(resolution.scope === ResolutionScope.TEAM){
    // TODO: we need a way to tell from which card the resolution is coming from in order to verify if the user is the 
    // owner of the card. If they are, then they can edit the resolution history.
  }

  const canWrite = 
    resolution.scope === ResolutionScope.PERSONAL && resolution.ownerUserId === requestingUserId || // Owner of the resolution
    resolution.scope === ResolutionScope.MEMBER_PROVIDED && resolution.toUserId === requestingUserId;  // Target user of a member-provided resolution
  const canView = await computeReadAccess(resolution, requestingUserId);

  return {
    resolution,
    canView,
    canWrite,
  };
}

export async function getResolutionHistoryEntries(
  resolutionId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<ResolutionHistoryEntry[]> {
  const safeLimit = Math.max(1, Math.min(100, toSafeInteger(limit, 50)));
  const safeOffset = Math.max(0, toSafeInteger(offset, 0));

  const rows = await query<ResolutionHistoryEntryRow[]>(
    `SELECT
       rhe.id,
       rhe.resolution_id,
       rhe.author_user_id,
       u.username AS author_username,
       rhe.entry_type,
       rhe.event_key,
       rhe.content,
       rhe.metadata_json,
       rhe.created_at
     FROM resolution_history_entries rhe
     JOIN users u ON u.id = rhe.author_user_id
     WHERE rhe.resolution_id = ?
     ORDER BY rhe.created_at DESC
     LIMIT ? OFFSET ?`,
    [resolutionId, safeLimit, safeOffset],
  );

  return rows.map(rowToResolutionHistoryEntry);
}

interface CreateResolutionHistoryEntryInput {
  resolutionId: string;
  authorUserId: string;
  entryType: ResolutionHistoryEntryType;
  content: string;
  eventKey?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function createResolutionHistoryEntry(
  input: CreateResolutionHistoryEntryInput,
): Promise<ResolutionHistoryEntry> {
  const trimmedContent = input.content.trim();
  if (!trimmedContent) {
    throw new Error('History content must be non-empty');
  }

  const id = uuidv4();
  await query(
    `INSERT INTO resolution_history_entries
      (id, resolution_id, author_user_id, entry_type, event_key, content, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.resolutionId,
      input.authorUserId,
      input.entryType,
      input.eventKey ?? null,
      trimmedContent,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );

  const rows = await query<ResolutionHistoryEntryRow[]>(
    `SELECT
       rhe.id,
       rhe.resolution_id,
       rhe.author_user_id,
       u.username AS author_username,
       rhe.entry_type,
       rhe.event_key,
       rhe.content,
       rhe.metadata_json,
       rhe.created_at
     FROM resolution_history_entries rhe
     JOIN users u ON u.id = rhe.author_user_id
     WHERE rhe.id = ?
     LIMIT 1`,
    [id],
  );

  if (rows.length === 0) {
    throw new Error('Failed to create history entry');
  }

  return rowToResolutionHistoryEntry(rows[0]);
}

export async function createManualResolutionHistoryEntry(
  resolutionId: string,
  authorUserId: string,
  content: string,
): Promise<ResolutionHistoryEntry> {
  return createResolutionHistoryEntry({
    resolutionId,
    authorUserId,
    entryType: 'manual_note',
    content,
  });
}

export async function createSystemResolutionHistoryEntry(
  resolutionId: string,
  authorUserId: string,
  eventKey: string,
  content: string,
  metadata?: Record<string, unknown> | null,
): Promise<ResolutionHistoryEntry> {
  return createResolutionHistoryEntry({
    resolutionId,
    authorUserId,
    entryType: 'system_event',
    eventKey,
    content,
    metadata,
  });
}
