import { NextRequest, NextResponse } from 'next/server';
import {
  getIterativeResolutionById,
  autoTransitionCellState,
  createSystemResolutionHistoryEntry,
} from '@/lib/db';
import type { Resolution } from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

interface IterativeProgressOptions {
  /** Repository call that applies the counter change. */
  applyChange: (id: string, userId: string) => Promise<Resolution | null>;
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
  applyChange,
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
      if (
        (existing.scope === 'personal' && existing.ownerUserId !== currentUser.id) ||   // Personal resolutions can only be modified by the owner
        (existing.scope === 'member_provided' && existing.toUserId !== currentUser.id)  // Member-provided resolutions can only be modified by the recipient
      ) {
        return errorResponse('You can only modify your own resolutions', 403);
      }

      const resolution = await applyChange(id, currentUser.id);
      if (!resolution) {
        return errorResponse(failureMessage, 500);
      }

      try {
        await createSystemResolutionHistoryEntry(
          id,
          currentUser.id,
          historyEventKey,
          `Progress updated: ${resolution.completedTimes} / ${resolution.numberOfRepetition ?? 0}`,
          {
            completedTimes: resolution.completedTimes,
            numberOfRepetition: resolution.numberOfRepetition,
          },
        );
      } catch {
        // Preserve the core counter change even if history logging fails.
      }

      const isComplete = resolution.completedTimes >= (resolution.numberOfRepetition ?? Infinity);
      const updatedCells = await autoTransitionCellState(
        id,
        ResolutionType.ITERATIVE,
        isComplete
      );

      return NextResponse.json({ resolution, updatedCells });
    });
}
