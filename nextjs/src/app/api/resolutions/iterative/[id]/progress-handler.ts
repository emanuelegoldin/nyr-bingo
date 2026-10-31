import { NextRequest, NextResponse } from 'next/server';
import { notifyResolution } from '@/lib/team-signals';
import {
  adjustIterativeProgress,
  canModifyProgress,
  getIterativeResolutionById,
  autoTransitionCellState,
  isProgressComplete,
  logResolutionHistoryEventSafe,
} from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

interface IterativeProgressOptions {
  /** Counter step to apply. */
  delta: 1 | -1;
  /** Error message returned when the change could not be applied. */
  failureMessage: string;
  /** Key of the history event logged for the change. */
  historyEventKey: string;
}

/**
 * Build the PATCH handler shared by the iterative increment and decrement routes.
 * Applies the counter change, logs it, and moves linked bingo cells to the state
 * that matches whether the threshold is met.
 *
 * @param options What differs between increment and decrement
 * @returns The authenticated PATCH route handler
 */
export function createIterativeProgressHandler({
  delta,
  failureMessage,
  historyEventKey,
}: IterativeProgressOptions) {
  return withAuth(
    async (_request: NextRequest, { params, currentUser }: AuthContext<{ id: string }>) => {
      const { id } = await params;

      const existing = await getIterativeResolutionById(id);
      if (!existing) {
        return errorResponse('Resolution not found', 404);
      }
      if (!canModifyProgress(existing, currentUser.id)) {
        return errorResponse('You can only modify your own resolutions', 403);
      }

      const resolution = await adjustIterativeProgress(id, currentUser.id, delta);
      if (!resolution) {
        return errorResponse(failureMessage, 500);
      }

      await logResolutionHistoryEventSafe(
        id,
        currentUser.id,
        historyEventKey,
        `Progress updated: ${resolution.completedTimes} / ${resolution.numberOfRepetition ?? 0}`,
        {
          completedTimes: resolution.completedTimes,
          numberOfRepetition: resolution.numberOfRepetition,
        },
      );

      const updatedCells = await autoTransitionCellState(
        id,
        ResolutionType.ITERATIVE,
        isProgressComplete(resolution)
      );

      await notifyResolution(id);

      return NextResponse.json({ resolution, updatedCells });
    });
}
