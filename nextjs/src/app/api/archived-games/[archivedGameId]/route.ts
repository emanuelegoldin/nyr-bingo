/**
 * Archived Game Detail API
 * Spec Reference: 18-game-archive.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import {
  deleteArchivedGame,
  getArchivedGame,
  getArchivedGameSummary,
} from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/archived-games/[archivedGameId] - Get an archived game (players only)
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ archivedGameId: string }>
) => {
  const { archivedGameId } = await params;

  const archivedGame = await getArchivedGame(archivedGameId);
  if (!archivedGame) {
    return errorResponse('Archived game not found', 404);
  }

  const denied = await requirePermission(currentUser, 'archive.view', { scope: 'archive', archivedGameId });
  if (denied) return denied;

  return NextResponse.json({ archivedGame });
});

/**
 * DELETE /api/archived-games/[archivedGameId] - Delete an archived game (its leaders only)
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ archivedGameId: string }>
) => {
  const { archivedGameId } = await params;

  const archivedGame = await getArchivedGameSummary(archivedGameId);
  if (!archivedGame) {
    return errorResponse('Archived game not found', 404);
  }

  const denied = await requirePermission(currentUser, 'archive.delete', { scope: 'archive', archivedGameId });
  if (denied) return denied;

  await deleteArchivedGame(archivedGameId);

  return NextResponse.json({ message: 'Archived game deleted successfully' });
});
