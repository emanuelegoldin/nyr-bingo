/**
 * Checks and follow-up shared by the cell progress routes.
 * Spec Reference: 06-bingo-gameplay.md - Progress on a Cell, 21-authorization.md - Status Rules
 */

import { NextResponse } from 'next/server';
import { errorResponse } from '@/app/api/utils';
import {
  autoTransitionCellState,
  getCellDetail,
  GameStatus,
  isCellProgressComplete,
  logCellHistoryEventSafe,
  type BingoCellDetail,
  type ResolutionType,
  type User,
} from '@/lib/db';
import { announceCellChanges } from '@/lib/notifications';
import { notifyCell } from '@/lib/team-signals';
import { requireCardOwner } from './card-owner';

/**
 * Load a cell whose progress the caller wants to change. Like every cell route, refusals are 400.
 * @param user The logged-in user
 * @param cellId The cell
 * @param type The type the route works on
 * @returns The cell, or the response refusing the change
 */
export async function loadCellForProgress(
  user: User,
  cellId: string,
  type: ResolutionType
): Promise<{ cell: BingoCellDetail } | { response: NextResponse }> {
  if (cellId.startsWith('joker:')) {
    return { response: errorResponse('Joker cell cannot be modified', 400) };
  }

  const denied = await requireCardOwner(user, cellId, 'Only the card owner can change its progress');
  if (denied) return { response: denied };

  const cell = await getCellDetail(cellId);
  if (!cell) {
    return { response: errorResponse('Cell not found', 400) };
  }
  // Spec: 16-games.md - Ending a Game
  if (cell.gameStatus === GameStatus.ENDED) {
    return { response: errorResponse('This game has ended', 400) };
  }
  if (cell.resolutionType !== type) {
    return { response: errorResponse(`This cell is not ${type}`, 400) };
  }
  return { cell };
}

/** The history event a progress change logs. */
export interface ProgressEvent {
  key: string;
  content: (cell: BingoCellDetail) => string;
  metadata: (cell: BingoCellDetail) => Record<string, unknown>;
}

/**
 * After a progress change: log it on the cell, move the cell to the state its progress calls
 * for, and signal the change.
 * @param cellId The changed cell
 * @param user The card owner who made the change
 * @param event The history event to log
 * @returns The response with the cell and any state change, or 400 if the cell is gone
 */
export async function respondWithProgress(
  cellId: string,
  user: User,
  event: ProgressEvent
): Promise<NextResponse> {
  const cell = await getCellDetail(cellId);
  if (!cell) {
    return errorResponse('Cell not found', 400);
  }

  await logCellHistoryEventSafe(cellId, user.id, event.key, event.content(cell), event.metadata(cell));

  const updatedCells = await autoTransitionCellState(cellId, isCellProgressComplete(cell));
  const current = updatedCells.length > 0 ? { ...cell, state: updatedCells[0].state } : cell;

  await notifyCell(cellId);
  await announceCellChanges(updatedCells, user.id);

  return NextResponse.json({ cell: current, updatedCells });
}
