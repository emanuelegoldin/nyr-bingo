/**
 * Compound Resolution Subtask Toggle API
 * Spec Reference: Resolution Rework — compound type
 *
 * PATCH /api/resolutions/compound/[id]/toggle — toggle a subtask's completed state
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { toggleCompoundSubtask, getCompoundResolutionById, autoTransitionCellState } from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';

/**
 * PATCH /api/resolutions/compound/[id]/toggle
 * Body: { subtaskIndex: number }
 *
 * Toggles the completed state of the subtask at the given index.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { subtaskIndex } = body;

    if (typeof subtaskIndex !== 'number' || subtaskIndex < 0) {
      return NextResponse.json({ error: 'Valid subtaskIndex is required' }, { status: 400 });
    }

    const existing = await getCompoundResolutionById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
    }
    if (existing.ownerUserId !== currentUser.id) {
      return NextResponse.json({ error: 'You can only modify your own resolutions' }, { status: 403 });
    }

    const resolution = await toggleCompoundSubtask(id, currentUser.id, subtaskIndex);
    if (!resolution) {
      return NextResponse.json({ error: 'Failed to toggle subtask' }, { status: 500 });
    }

    // Auto-transition bingo cells: all subtasks done → completed, otherwise → pending
    const allDone = resolution.subtasks.every((s) => s.completed);
    const updatedCells = await autoTransitionCellState(
      id,
      ResolutionType.COMPOUND,
      allDone
    );

    return NextResponse.json({ resolution, updatedCells });
  } catch (error) {
    console.error('Toggle compound subtask error:', error);
    const message = error instanceof Error ? error.message : 'An error occurred';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
