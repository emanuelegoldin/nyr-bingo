/**
 * Request Proof API
 * Spec Reference: Resolution Review & Proof Workflow - Request Proof
 */

import { NextRequest, NextResponse } from 'next/server';
import { notifications } from '@/lib/notifications';
import { notifyCell } from '@/lib/team-signals';
import { getGameIdForCell, authorize } from '@/lib/authz';
import { getGameById, requestProof } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/cells/[cellId]/request-proof - Request proof for a completed cell
 * Creates a review thread for the cell
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;

  // Spec: 21-authorization.md - thread.request: a player of the cell's game. Cell routes refuse with 400.
  const gameId = await getGameIdForCell(cellId);
  const game = gameId ? await getGameById(gameId) : null;
  if (!game) {
    return errorResponse('Cell not found', 400);
  }
  const decision = await authorize(currentUser, 'thread.request', { scope: 'game', game });
  if (!decision.allowed) {
    return errorResponse(decision.error, 400);
  }

  const result = await requestProof(cellId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error, 400);
  }
  await notifyCell(cellId);
  await notifications.publish({ type: 'proof_requested', actorUserId: currentUser.id, cellId });
  return NextResponse.json({ thread: result.thread }, { status: 201 });
});
