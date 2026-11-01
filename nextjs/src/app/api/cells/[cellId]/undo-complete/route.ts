/**
 * Undo Complete API
 * Spec Reference: Resolution Review & Proof Workflow - Undo Completion
 */

import { NextRequest, NextResponse } from 'next/server';
import { notifications } from '@/lib/notifications';
import { notifyCell } from '@/lib/team-signals';
import { undoCompletion } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/cells/[cellId]/undo-complete - Undo mistaken completion
 * Reverts cell to pending state and closes any open review thread
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const result = await undoCompletion(cellId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error, 400);
  }
  await notifyCell(cellId);
  await notifications.cancelCell(cellId);
  return NextResponse.json({ cell: result.cell });
});
