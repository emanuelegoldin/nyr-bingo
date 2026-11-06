/**
 * Bingo Card Repository - Reading bingo cards
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md
 */

import { CellSourceType, CellState, getJokerPosition, ResolutionType } from '../shared/types';
import { CardRow, CellRow, rowToCard, rowToCell, SELECT_CELL_WITH_RESOLVED_TEXT } from './bingo-card-rows';
import { query } from './connection';
import {
  BingoCard,
  BingoCardWithCells,
  BingoCellWithThread,
} from './types';

/**
 * Build the implicit Joker cell, which is not stored in the DB.
 * @param cardId The card the Joker belongs to
 * @param gridSize The side length of the card
 * @returns The cell to show at the center of the grid
 */
function makeJokerCell(cardId: string, gridSize: number): BingoCellWithThread {
  return {
    id: `joker:${cardId}`,
    cardId,
    position: getJokerPosition(gridSize),
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

/** Which cards to load the cells of: one card, or every card of a game. */
type CellFilter = { cardId: string } | { gameId: string };

/**
 * Load the cells of one card or of every card of a game, each with its open review thread,
 * in two queries run in parallel.
 * @param filter The card, or the game whose cards are loaded
 * @returns The cells of each card, keyed by card id, sorted by position with the Joker added
 */
async function getCellsWithThreadsByCard(filter: CellFilter): Promise<Map<string, BingoCellWithThread[]>> {
  const [where, param] = 'cardId' in filter
    ? ['c.card_id = ?', filter.cardId]
    : ['bc.game_id = ?', filter.gameId];

  const [cellRows, threadRows] = await Promise.all([
    query<CellRow[]>(
      `${SELECT_CELL_WITH_RESOLVED_TEXT}
       WHERE ${where}
       ORDER BY c.position ASC`,
      [param]
    ),
    query<{ id: string; cell_id: string }[]>(
      `SELECT rt.id, rt.cell_id
       FROM review_threads rt
       JOIN bingo_cells c ON rt.cell_id = c.id
       JOIN bingo_cards bc ON c.card_id = bc.id
       WHERE ${where} AND rt.status = 'open'
       ORDER BY rt.created_at DESC`,
      [param]
    ),
  ]);

  // Newest open thread per cell (rows are newest first)
  const openThreadByCell = new Map<string, string>();
  for (const row of threadRows) {
    if (!openThreadByCell.has(row.cell_id)) openThreadByCell.set(row.cell_id, row.id);
  }

  const cellsByCard = new Map<string, BingoCellWithThread[]>();
  for (const row of cellRows) {
    const cell = rowToCell(row);
    const cells = cellsByCard.get(cell.cardId) ?? [];
    cells.push({ ...cell, reviewThreadId: openThreadByCell.get(cell.id) ?? null });
    cellsByCard.set(cell.cardId, cells);
  }
  return cellsByCard;
}

/**
 * Complete a card's cells with the implicit Joker cell and sort them by position.
 * @param card The card, whose size places the Joker
 * @param cells Its stored cells, if any
 * @returns The full grid
 */
function withJoker(card: BingoCard, cells: BingoCellWithThread[] = []): BingoCellWithThread[] {
  const jokerPosition = getJokerPosition(card.gridSize);
  if (!cells.some((c) => c.position === jokerPosition)) {
    cells.push(makeJokerCell(card.id, card.gridSize));
  }
  return cells.sort((a, b) => a.position - b.position);
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
  const cellsByCard = await getCellsWithThreadsByCard({ cardId: card.id });

  return {
    ...card,
    cells: withJoker(card, cellsByCard.get(card.id)),
  };
}

/**
 * Get all bingo cards of a game (for visibility)
 * @param gameId The game
 * @returns Its cards with their cells
 * Spec: 08-visibility-and-updates.md
 */
export async function getGameBingoCards(gameId: string): Promise<BingoCardWithCells[]> {
  // The caller checks that the user may view the game (spec 21: game.view)
  const [cardRows, cellsByCard] = await Promise.all([
    query<CardRow[]>(
      `SELECT * FROM bingo_cards WHERE game_id = ?`,
      [gameId]
    ),
    getCellsWithThreadsByCard({ gameId }),
  ]);

  return cardRows.map((row) => {
    const card = rowToCard(row);
    return { ...card, cells: withJoker(card, cellsByCard.get(card.id)) };
  });
}
