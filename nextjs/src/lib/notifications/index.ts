/**
 * The notification module (spec 19). Replacing the implementation means changing this one export.
 */

import { CellSourceType, CellState, ResolutionType } from '../shared/types';
import { dbPublisher } from './db-publisher';
import type { NotificationPublisher } from './types';

export const notifications: NotificationPublisher = dbPublisher;

/** The parts of a cell that decide what its new state means. */
interface ChangedCell {
  id: string;
  state: CellState;
  sourceType: CellSourceType;
  resolutionType: ResolutionType;
}

/**
 * Announce cells that changed state: a completed cell is progress, and a pending one cancels what
 * was held for it. A typed team goal is not progress, because one change moves it on every card.
 *
 * @param cells - The cells, in their new state.
 * @param actorUserId - The user who changed them.
 */
export async function announceCellChanges(cells: ChangedCell[], actorUserId: string): Promise<void> {
  for (const cell of cells) {
    const isTypedTeamGoal = cell.sourceType === CellSourceType.TEAM && cell.resolutionType !== ResolutionType.BASE;

    if (cell.state === CellState.PENDING) {
      await notifications.cancelCell(cell.id);
    } else if (cell.state === CellState.COMPLETED && !isTypedTeamGoal) {
      await notifications.publish({ type: 'card_progress', actorUserId, cellId: cell.id });
    }
  }
}
