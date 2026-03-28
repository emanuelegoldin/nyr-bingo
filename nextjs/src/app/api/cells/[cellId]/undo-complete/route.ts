/**
 * Undo Complete API
 * Spec Reference: Resolution Review & Proof Workflow - Undo Completion
 */

import { NextRequest, NextResponse } from 'next/server';
import { undoCompletion, User } from '@/lib/db';
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
  return NextResponse.json({ cell: result.cell });
});
