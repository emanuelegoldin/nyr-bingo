import { NextRequest } from 'next/server';
import { AuthContext, withAuth } from '@/app/api/utils';
import { adjustCellIterativeProgress, ResolutionType } from '@/lib/db';
import { loadCellForProgress, respondWithProgress } from '../../cell-progress';

interface IterativeProgressOptions {
  /** Counter step to apply. */
  delta: 1 | -1;
  /** Key of the history event logged for the change. */
  historyEventKey: string;
}

/**
 * Build the PATCH handler shared by the iterative increment and decrement routes.
 * Spec: 06-bingo-gameplay.md - Progress on a Cell
 *
 * @param options What differs between increment and decrement
 * @returns The authenticated PATCH route handler
 */
export function createIterativeProgressHandler({ delta, historyEventKey }: IterativeProgressOptions) {
  return withAuth(async (
    _request: NextRequest,
    { params, currentUser }: AuthContext<{ cellId: string }>
  ) => {
    const { cellId } = await params;

    const loaded = await loadCellForProgress(currentUser, cellId, ResolutionType.ITERATIVE);
    if ('response' in loaded) return loaded.response;

    await adjustCellIterativeProgress(cellId, delta);

    return respondWithProgress(cellId, currentUser, {
      key: historyEventKey,
      content: (cell) => `Progress updated: ${cell.completedTimes} / ${cell.numberOfRepetition ?? 0}`,
      metadata: (cell) => ({
        completedTimes: cell.completedTimes,
        numberOfRepetition: cell.numberOfRepetition,
      }),
    });
  });
}
