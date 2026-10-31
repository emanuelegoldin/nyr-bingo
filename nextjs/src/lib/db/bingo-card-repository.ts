/**
 * Bingo Card Repository - Reading bingo cards
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md
 */

import { CellSourceType, CellState, JOKER_POSITION, ProofStatus, ResolutionType } from '../shared/types';
import { CardRow, CellRow, rowToCard, rowToCell, SELECT_CELL_WITH_RESOLVED_TEXT } from './bingo-card-rows';
import { query } from './connection';
import { isTeamMember } from './team-repository';
import {
  BingoCardWithCells,
  BingoCellWithProof,
  CellProof,
} from './types';

interface ProofRow {
  id: string;
  cell_id: string;
  file_url: string | null;
  comment: string | null;
  status: ProofStatus;
  created_at: Date;
  updated_at: Date;
}

function rowToProof(row: ProofRow): CellProof {
  return {
    id: row.id,
    cellId: row.cell_id,
    fileUrl: row.file_url,
    comment: row.comment,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Build the implicit Joker cell, which is not stored in the DB.
 * @param cardId The card the Joker belongs to
 * @returns The cell to show at the center of the grid
 */
function makeJokerCell(cardId: string): BingoCellWithProof {
  return {
    id: `joker:${cardId}`,
    cardId,
    position: JOKER_POSITION,
    resolutionId: null,
    resolutionType: ResolutionType.BASE,
    resolutionText: 'Joker',
    resolutionTitle: 'Joker',
    isJoker: true,
    isEmpty: false,
    sourceType: CellSourceType.TEAM,
    sourceUserId: null,
    state: CellState.PENDING,
    createdAt: new Date(),
    updatedAt: new Date(),
    proof: null,
    reviewThreadId: null,
  };
}

/**
 * Get bingo card for a user in a team
 */
export async function getBingoCard(
  teamId: string,
  userId: string
): Promise<BingoCardWithCells | null> {
  const cardRows = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE team_id = ? AND user_id = ?`,
    [teamId, userId]
  );

  if (cardRows.length === 0) return null;

  const card = rowToCard(cardRows[0]);
  const cells = await getCellsWithProofs(card.id);

  return {
    ...card,
    cells,
  };
}

/**
 * Get cells with proofs for a card
 */
async function getCellsWithProofs(cardId: string): Promise<BingoCellWithProof[]> {
  const cellRows = await query<CellRow[]>(
    `${SELECT_CELL_WITH_RESOLVED_TEXT}
     WHERE c.card_id = ?
     ORDER BY c.position ASC`,
    [cardId]
  );

  const cells: BingoCellWithProof[] = [];

  for (const row of cellRows) {
    const cell = rowToCell(row);

    // Get latest proof if any
    const proofRows = await query<ProofRow[]>(
      `SELECT * FROM cell_proofs WHERE cell_id = ? ORDER BY created_at DESC LIMIT 1`,
      [cell.id]
    );

    const threadRows = await query<{ id: string }[]>(
      `SELECT id FROM review_threads WHERE cell_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
      [cell.id]
    );

    cells.push({
      ...cell,
      proof: proofRows.length > 0 ? rowToProof(proofRows[0]) : null,
      reviewThreadId: threadRows.length > 0 ? threadRows[0].id : null,
    });
  }

  // Ensure the implicit Joker cell exists in the returned grid.
  if (!cells.some((c) => c.position === JOKER_POSITION)) {
    cells.push(makeJokerCell(cardId));
  }

  cells.sort((a, b) => a.position - b.position);

  return cells;
}

/**
 * Get all bingo cards for a team (for visibility)
 * Spec: 08-visibility-and-updates.md
 */
export async function getTeamBingoCards(
  teamId: string,
  requestingUserId: string
): Promise<BingoCardWithCells[]> {
  // Verify requesting user is a team member
  // Spec: 08-visibility-and-updates.md - Only team members can view team cards
  const isMember = await isTeamMember(teamId, requestingUserId);
  if (!isMember) {
    return [];
  }

  const cardRows = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE team_id = ?`,
    [teamId]
  );

  const cards: BingoCardWithCells[] = [];

  for (const row of cardRows) {
    const card = rowToCard(row);
    const cells = await getCellsWithProofs(card.id);
    cards.push({ ...card, cells });
  }

  return cards;
}
