/**
 * Row types and mappers shared by the bingo card modules.
 * Internal to lib/db: not exported from the barrel.
 */

import { CellSourceType, CellState, ResolutionType } from '../shared/types';
import { query } from './connection';
import { BingoCard, BingoCell } from './types';

// Row types from database
export interface CardRow {
  id: string;
  team_id: string;
  user_id: string;
  grid_size: number;
  created_at: Date;
}

export interface CellRow {
  id: string;
  card_id: string;
  position: number;
  resolution_id: string | null;
  resolution_type: ResolutionType;
  // Derived display text (resolved from join with unified resolutions table)
  resolution_text: string;
  resolution_title: string;
  is_empty: boolean | number;
  source_type: CellSourceType;
  source_user_id: string | null;
  state: CellState;
  created_at: Date;
  updated_at: Date;
}

// Convert functions
export function rowToCard(row: CardRow): BingoCard {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    gridSize: row.grid_size,
    createdAt: row.created_at,
  };
}

export function rowToCell(row: CellRow): BingoCell {
  return {
    id: row.id,
    cardId: row.card_id,
    position: row.position,
    resolutionId: row.resolution_id,
    resolutionType: row.resolution_type,
    resolutionText: row.resolution_text,
    resolutionTitle: row.resolution_title,
    // Spec: 05-bingo-card-generation.md - Joker is implicit and not stored in the DB.
    isJoker: false,
    isEmpty: Boolean(row.is_empty),
    sourceType: row.source_type,
    sourceUserId: row.source_user_id,
    state: row.state,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const SELECT_CELL_WITH_RESOLVED_TEXT = `
  SELECT
    c.id,
    c.card_id,
    c.position,
    c.resolution_id,
    c.resolution_type,
    CASE
      WHEN c.is_empty THEN 'Empty'
      WHEN c.resolution_id IS NOT NULL THEN COALESCE(r.description, '')
      ELSE ''
    END AS resolution_text,
    CASE
      WHEN c.is_empty THEN 'Empty'
      WHEN c.resolution_id IS NOT NULL THEN COALESCE(r.title, '')
      ELSE ''
    END AS resolution_title,
    c.is_empty,
    c.source_type,
    c.source_user_id,
    c.state,
    c.created_at,
    c.updated_at
  FROM bingo_cells c
  JOIN bingo_cards bc ON c.card_id = bc.id
  LEFT JOIN resolutions r ON c.resolution_id = r.id
`;

export async function getResolvedCellRowById(cellId: string): Promise<CellRow | null> {
  const rows = await query<CellRow[]>(
    `${SELECT_CELL_WITH_RESOLVED_TEXT}
     WHERE c.id = ?`,
    [cellId]
  );
  return rows.length > 0 ? rows[0] : null;
}
