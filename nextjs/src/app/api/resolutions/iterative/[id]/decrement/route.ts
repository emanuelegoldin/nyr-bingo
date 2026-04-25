/**
 * Decrement Iterative Resolution API
 * Spec Reference: Resolution Rework — iterative type
 *
 * PATCH /api/resolutions/iterative/[id]/decrement
 * Decrements the completed_times counter (floor 0) and reverts bingo cell if below threshold.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getIterativeResolutionById,
  decrementIterativeResolution,
  autoTransitionCellState,
  createSystemResolutionHistoryEntry,
} from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * PATCH /api/resolutions/iterative/[id]/decrement
 * Decrements the completed_times counter by 1 (minimum 0).
 */
export const PATCH = withAuth(
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

    const resolution = await decrementIterativeResolution(id, currentUser.id);
    if (!resolution) {
      return errorResponse('Failed to decrement', 500);
    }

    try {
      await createSystemResolutionHistoryEntry(
        id,
        currentUser.id,
        'resolution.iterative_decremented',
        `Progress updated: ${resolution.completedTimes} / ${resolution.numberOfRepetition ?? 0}`,
        {
          completedTimes: resolution.completedTimes,
          numberOfRepetition: resolution.numberOfRepetition,
        },
      );
    } catch {
      // Preserve core decrement behavior even if history logging fails.
    }

    // Auto-transition bingo cells: dropped below threshold → revert to pending
    const isComplete = resolution.completedTimes >= (resolution.numberOfRepetition ?? Infinity);
    const updatedCells = await autoTransitionCellState(
      id,
      ResolutionType.ITERATIVE,
      isComplete
    );

    return NextResponse.json({ resolution, updatedCells });
  });
