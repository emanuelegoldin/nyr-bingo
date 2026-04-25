/**
 * Compound Resolution Subtask Toggle API
 * Spec Reference: Resolution Rework — compound type
 *
 * PATCH /api/resolutions/compound/[id]/toggle — toggle a subtask's completed state
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  toggleCompoundSubtask,
  getCompoundResolutionById,
  autoTransitionCellState,
  createSystemResolutionHistoryEntry,
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

  if (typeof subtaskIndex !== 'number' || subtaskIndex < 0) {
    return errorResponse('Valid subtaskIndex is required', 400);
  }

  const existing = await getCompoundResolutionById(id);
  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (
    (existing.scope === 'personal' && existing.ownerUserId !== currentUser.id) ||   // Personal resolutions can only be modified by the owner
    (existing.scope === 'member_provided' && existing.toUserId !== currentUser.id)  // Member-provided resolutions can only be modified by the recipient
  ) {
    return errorResponse('You can only modify your own resolutions', 403);
  }

  const resolution = await toggleCompoundSubtask(id, currentUser.id, subtaskIndex);
  if (!resolution) {
    return errorResponse('Failed to toggle subtask', 500);
  }

  const previousSubtask = existing.subtasks?.[subtaskIndex];
  const updatedSubtask = resolution.subtasks?.[subtaskIndex];
  if (updatedSubtask) {
    try {
      await createSystemResolutionHistoryEntry(
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
    } catch {
      // Preserve core toggle behavior even if history logging fails.
    }
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
