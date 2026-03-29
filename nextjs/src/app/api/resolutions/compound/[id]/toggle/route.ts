/**
 * Compound Resolution Subtask Toggle API
 * Spec Reference: Resolution Rework — compound type
 *
 * PATCH /api/resolutions/compound/[id]/toggle — toggle a subtask's completed state
 */

import { NextRequest, NextResponse } from 'next/server';
import { toggleCompoundSubtask, getCompoundResolutionById, autoTransitionCellState, User } from '@/lib/db';
import { ResolutionType } from '@/lib/shared/types';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * PATCH /api/resolutions/compound/[id]/toggle
 * Body: { subtaskIndex: number }
 *
 * Toggles the completed state of the subtask at the given index.
 */
export const PATCH = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ id: string }>
) => {
  const { id } = await params;
  const body = await request.json();
  const { subtaskIndex } = body;

  if (typeof subtaskIndex !== 'number' || subtaskIndex < 0) {
    return errorResponse('Valid subtaskIndex is required', 400);
  }

  const existing = await getCompoundResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (existing.ownerUserId !== currentUser.id) {
    return errorResponse('You can only modify your own resolutions', 403);
  }

  const resolution = await toggleCompoundSubtask(id, currentUser.id, subtaskIndex);
  if (!resolution) {
    return errorResponse('Failed to toggle subtask', 500);
  }

  // Auto-transition bingo cells: all subtasks done → completed, otherwise → pending
  const allDone = resolution.subtasks?.every((s) => s.completed) ?? false;
  const updatedCells = await autoTransitionCellState(
    id,
    ResolutionType.COMPOUND,
    allDone
  );

  return NextResponse.json({ resolution, updatedCells });
});
