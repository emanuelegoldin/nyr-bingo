/**
 * Bingo Card Repository - Reading bingo cards
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md
 */

import { CellSourceType, CellState, JOKER_POSITION, ResolutionType } from '../shared/types';
import { CardRow, CellRow, rowToCard, rowToCell, SELECT_CELL_WITH_RESOLVED_TEXT } from './bingo-card-rows';
import { query } from './connection';
import { getGameById } from './game-repository';
import { isTeamMember } from './team-repository';
import {
  BingoCardWithCells,
  BingoCellWithThread,
} from './types';

/**
 * Build the implicit Joker cell, which is not stored in the DB.
 * @param cardId The card the Joker belongs to
 * @returns The cell to show at the center of the grid
 */
function makeJokerCell(cardId: string): BingoCellWithThread {
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
    reviewThreadId: null,
  };
}

/**
 * Get a user's bingo card for a game
 */
export async function getBingoCard(
  gameId: string,
  userId: string
): Promise<BingoCardWithCells | null> {
  const cardRows = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE game_id = ? AND user_id = ?`,
    [gameId, userId]
  );

  if (cardRows.length === 0) return null;

  const card = rowToCard(cardRows[0]);
  const cells = await getCellsWithThreads(card.id);

  return {
    ...card,
    cells,
  };
}

/**
 * Get a card's cells with their open review thread
 */
async function getCellsWithThreads(cardId: string): Promise<BingoCellWithThread[]> {
  const cellRows = await query<CellRow[]>(
    `${SELECT_CELL_WITH_RESOLVED_TEXT}
     WHERE c.card_id = ?
     ORDER BY c.position ASC`,
    [cardId]
  );

  const cells: BingoCellWithThread[] = [];

  for (const row of cellRows) {
    const cell = rowToCell(row);

    const threadRows = await query<{ id: string }[]>(
      `SELECT id FROM review_threads WHERE cell_id = ? AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
      [cell.id]
    );

    cells.push({
      ...cell,
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
 * Get all bingo cards of a game (for visibility)
 * Spec: 08-visibility-and-updates.md
 */
export async function getGameBingoCards(
  gameId: string,
  requestingUserId: string
): Promise<BingoCardWithCells[]> {
  // Verify requesting user is a team member
  // Spec: 08-visibility-and-updates.md - Only team members can view team cards
  const game = await getGameById(gameId);
  if (!game || !(await isTeamMember(game.teamId, requestingUserId))) {
    return [];
  }

  const cardRows = await query<CardRow[]>(
    `SELECT * FROM bingo_cards WHERE game_id = ?`,
    [gameId]
  );

  const cards: BingoCardWithCells[] = [];

  for (const row of cardRows) {
    const card = rowToCard(row);
    const cells = await getCellsWithThreads(card.id);
    cards.push({ ...card, cells });
  }

  return cards;
}
