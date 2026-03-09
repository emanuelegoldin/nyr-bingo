/**
 * Decrement Iterative Resolution API
 * Spec Reference: Resolution Rework — iterative type
 *
 * PATCH /api/resolutions/iterative/[id]/decrement
 * Decrements the completed_times counter (floor 0) and reverts bingo cell if below threshold.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import {
  getIterativeResolutionById,
  decrementIterativeResolution,
  autoTransitionCellState,
} from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';

/**
 * PATCH /api/resolutions/iterative/[id]/decrement
 * Decrements the completed_times counter by 1 (minimum 0).
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;

    const existing = await getIterativeResolutionById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json({ error: 'You can only modify your own resolutions' }, { status: 403 });
    }

    const resolution = await decrementIterativeResolution(id, currentUser.id);
    if (!resolution) {
      return NextResponse.json({ error: 'Failed to decrement' }, { status: 500 });
    }

    // Auto-transition bingo cells: dropped below threshold → revert to pending
    const isComplete = resolution.completedTimes >= (resolution.numberOfRepetition ?? Infinity);
    const updatedCells = await autoTransitionCellState(
      id,
      ResolutionType.ITERATIVE,
      isComplete
    );

    return NextResponse.json({ resolution, updatedCells });
  } catch (error) {
    console.error('Decrement iterative resolution error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
