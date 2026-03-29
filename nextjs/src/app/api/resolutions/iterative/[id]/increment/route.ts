/**
 * Increment Iterative Resolution API
 * Spec Reference: Resolution Rework — iterative type
 *
 * PATCH /api/resolutions/iterative/[id]/increment
 * Increments the completed_times counter and auto-completes bingo cell if threshold met.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getIterativeResolutionById,
  incrementIterativeResolution,
  autoTransitionCellState,
  createSystemResolutionHistoryEntry,
} from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * PATCH /api/resolutions/iterative/[id]/increment
 * Increments the completed_times counter by 1.
 */
export const PATCH = withAuth(
  async (_request: NextRequest, { params, currentUser }: AuthContext<{ id: string }>) => {
    const { id } = await params;

    const existing = await getIterativeResolutionById(id);
    if (!existing) {
      return errorResponse('Resolution not found', 404);
    }
    if (existing.ownerUserId !== currentUser.id) {
      return errorResponse('You can only modify your own resolutions', 403);
    }

    const resolution = await incrementIterativeResolution(id, currentUser.id);
    if (!resolution) {
      return errorResponse('Failed to increment', 500);
    }

    try {
      await createSystemResolutionHistoryEntry(
        id,
        currentUser.id,
        'resolution.iterative_incremented',
        `Progress updated: ${resolution.completedTimes} / ${resolution.numberOfRepetition ?? 0}`,
        {
          completedTimes: resolution.completedTimes,
          numberOfRepetition: resolution.numberOfRepetition,
        },
      );
    } catch {
      // Preserve core increment behavior even if history logging fails.
    }

    // Auto-transition bingo cells: threshold met → completed
    const isComplete = resolution.completedTimes >= (resolution.numberOfRepetition ?? Infinity);
    const updatedCells = await autoTransitionCellState(
      id,
      ResolutionType.ITERATIVE,
      isComplete
    );

    return NextResponse.json({ resolution, updatedCells });
  });
