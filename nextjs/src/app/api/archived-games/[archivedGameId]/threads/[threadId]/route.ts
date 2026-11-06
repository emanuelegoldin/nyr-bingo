/**
 * Archived Thread API
 * Spec Reference: 18-game-archive.md - Deleting an Archived Thread
 */

import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import { requirePermission } from '@/lib/authz';
import { deleteArchivedThread, getArchivedGameSummary } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * DELETE /api/archived-games/[archivedGameId]/threads/[threadId] - Delete an archived thread
 * (the admins who ran the game only)
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ archivedGameId: string; threadId: string }>
) => {
  const { archivedGameId, threadId } = await params;

  const archivedGame = await getArchivedGameSummary(archivedGameId);
  if (!archivedGame) {
    return errorResponse('Archived game not found', 404);
  }

  const denied = await requirePermission(currentUser, 'archive.thread.delete', { scope: 'archive', archivedGameId });
  if (denied) return denied;

  const result = await deleteArchivedThread(archivedGameId, threadId);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }

  return NextResponse.json({ success: true });
});
