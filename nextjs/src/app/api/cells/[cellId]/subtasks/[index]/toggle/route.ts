/**
 * Compound Cell Subtask Toggle API
 * Spec Reference: 06-bingo-gameplay.md - Progress on a Cell
 *
 * PATCH /api/cells/[cellId]/subtasks/[index]/toggle - toggle one subtask of a compound cell
 */

import { NextRequest } from 'next/server';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import { ResolutionType, toggleCellSubtask } from '@/lib/db';
import { loadCellForProgress, respondWithProgress } from '../../../../cell-progress';

export const PATCH = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string; index: string }>
) => {
  const { cellId, index } = await params;
  const subtaskIndex = Number(index);

  const loaded = await loadCellForProgress(currentUser, cellId, ResolutionType.COMPOUND);
  if ('response' in loaded) return loaded.response;

  const subtaskCount = loaded.cell.subtasks?.length ?? 0;
  if (!Number.isInteger(subtaskIndex) || subtaskIndex < 0 || subtaskIndex >= subtaskCount) {
    return errorResponse('Valid subtask index is required', 400);
  }

  if (!await toggleCellSubtask(cellId, subtaskIndex)) {
    return errorResponse('Failed to toggle subtask', 500);
  }

  const previousCompleted = loaded.cell.subtasks?.[subtaskIndex]?.completed ?? null;
  return respondWithProgress(cellId, currentUser, {
    key: 'resolution.compound_subtask_toggled',
    content: (cell) => {
      const subtask = cell.subtasks?.[subtaskIndex];
      return subtask?.completed
        ? `Completed subtask: ${subtask.title}`
        : `Marked subtask as incomplete: ${subtask?.title ?? ''}`;
    },
    metadata: (cell) => ({
      subtaskIndex,
      title: cell.subtasks?.[subtaskIndex]?.title ?? null,
      previousCompleted,
      currentCompleted: cell.subtasks?.[subtaskIndex]?.completed ?? null,
      completedSubtasks: cell.subtasks?.filter((subtask) => subtask.completed).length ?? 0,
      totalSubtasks: cell.subtasks?.length ?? 0,
    }),
  });
});
