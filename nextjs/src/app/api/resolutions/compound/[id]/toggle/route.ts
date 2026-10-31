/**
 * Compound Resolution Subtask Toggle API
 * Spec Reference: Resolution Rework — compound type
 *
 * PATCH /api/resolutions/compound/[id]/toggle — toggle a subtask's completed state
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  canModifyProgress,
  toggleCompoundSubtask,
  getCompoundResolutionById,
  autoTransitionCellState,
  isProgressComplete,
  logResolutionHistoryEventSafe,
} from '@/lib/db';
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

  if (!Number.isInteger(subtaskIndex) || subtaskIndex < 0) {
    return errorResponse('Valid subtaskIndex is required', 400);
  }

  const existing = await getCompoundResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (!canModifyProgress(existing, currentUser.id)) {
    return errorResponse('You can only modify your own resolutions', 403);
  }

  if (subtaskIndex >= (existing.subtasks?.length ?? 0)) {
    return errorResponse('Valid subtaskIndex is required', 400);
  }

  const resolution = await toggleCompoundSubtask(id, currentUser.id, subtaskIndex);
  if (!resolution) {
    return errorResponse('Failed to toggle subtask', 500);
  }

  const previousSubtask = existing.subtasks?.[subtaskIndex];
  const updatedSubtask = resolution.subtasks?.[subtaskIndex];
  if (updatedSubtask) {
    await logResolutionHistoryEventSafe(
      id,
      currentUser.id,
      'resolution.compound_subtask_toggled',
      updatedSubtask.completed
        ? `Completed subtask: ${updatedSubtask.title}`
        : `Marked subtask as incomplete: ${updatedSubtask.title}`,
      {
        subtaskIndex,
        title: updatedSubtask.title,
        previousCompleted: previousSubtask?.completed ?? null,
        currentCompleted: updatedSubtask.completed,
        completedSubtasks: resolution.subtasks?.filter((s) => s.completed).length ?? 0,
        totalSubtasks: resolution.subtasks?.length ?? 0,
      },
    );
  }

  // Auto-transition bingo cells: all subtasks done → completed, otherwise → pending
  const updatedCells = await autoTransitionCellState(
    id,
    ResolutionType.COMPOUND,
    isProgressComplete(resolution)
  );

  return NextResponse.json({ resolution, updatedCells });
});
