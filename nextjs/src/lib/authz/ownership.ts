/**
 * Resource rules: actions that depend on who owns a record rather than on a role.
 * Spec Reference: 21-authorization.md - Resource Rules (Ownership)
 */

import { getCellDetail } from '@/lib/db/cell-progress-repository';
import type { CellAccess, Resolution, ReviewThread } from '@/lib/db/types';
import { getGameRole } from './roles';

/**
 * Whether a user owns a resolution, and so may edit or delete it.
 * @param resolution The resolution
 * @param userId The user
 * @returns True if the user is its owner
 */
export function isResolutionOwner(resolution: Pick<Resolution, 'ownerUserId'>, userId: string): boolean {
  return resolution.ownerUserId === userId;
}

/**
 * Whether a user owns a bingo card, and so may complete, undo or edit its cells.
 * @param cardUserId The owner of the card
 * @param userId The user
 * @returns True if the card is the user's
 */
export function isCardOwner(cardUserId: string, userId: string): boolean {
  return cardUserId === userId;
}

/**
 * Whether a user completed the cell under review, and so may close the thread and manage its proof.
 * @param thread The review thread
 * @param userId The user
 * @returns True if the user is the completing user
 */
export function isThreadCompleter(thread: Pick<ReviewThread, 'completedByUserId'>, userId: string): boolean {
  return thread.completedByUserId === userId;
}


/**
 * Load a cell with the user's access to it: viewing the cell and its history, and writing notes.
 * Spec: 13-resolution-history-and-progress.md - Manual Entry Creation, History Visibility
 * @param cellId The cell
 * @param userId The user
 * @returns The cell (null when it does not exist); the players of its game may view its history,
 *   and only the card owner may write to it
 */
export async function getCellAccess(
  cellId: string,
  userId: string,
): Promise<CellAccess> {
  const cell = await getCellDetail(cellId);
  if (!cell) {
    return { cell: null, canView: false, canWrite: false };
  }

  const canWrite = isCardOwner(cell.cardUserId, userId);
  const canView = canWrite || (await getGameRole(cell.gameId, userId)) !== null;

  return { cell, canView, canWrite };
}
