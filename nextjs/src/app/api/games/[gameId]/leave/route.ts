/**
 * Leave Game API
 * Spec Reference: 16-games.md - Leaving a Game
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRunningGame, leaveGame } from '@/lib/db';
import { notifyTeams } from '@/lib/team-signals';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/games/[gameId]/leave - Leave a running game (players only)
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  const game = await getRunningGame(gameId);
  if (!game) {
    return errorResponse('Game not found', 404);
  }

  const result = await leaveGame(gameId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }

  await notifyTeams([game.teamId]);

  return NextResponse.json({ message: 'You left the game' });
});
