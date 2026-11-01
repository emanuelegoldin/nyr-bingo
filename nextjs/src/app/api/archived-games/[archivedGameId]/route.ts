/**
 * Archived Game Detail API
 * Spec Reference: 18-game-archive.md
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  deleteArchivedGame,
  getArchivedGame,
  getArchivedGameSummary,
  isArchivedGamePlayer,
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

  if (!(await isArchivedGamePlayer(archivedGameId, currentUser.id))) {
    return errorResponse('You did not take part in this game', 403);
  }

  return NextResponse.json({ archivedGame });
});

/**
 * DELETE /api/archived-games/[archivedGameId] - Delete an archived game (its leader only)
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

  if (archivedGame.leaderUserId !== currentUser.id) {
    return errorResponse('Only the leader of the game can delete it', 403);
  }

  await deleteArchivedGame(archivedGameId);

  return NextResponse.json({ message: 'Archived game deleted successfully' });
});
