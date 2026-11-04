/**
 * Leave Game API
 * Spec Reference: 16-games.md - Leaving a Game
 */

import { NextRequest, NextResponse } from 'next/server';
import { leaveGame } from '@/lib/db';
import { notifyTeams } from '@/lib/team-signals';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import { authorizeGameAction } from '@/app/api/games/game-access';

/**
 * POST /api/games/[gameId]/leave - Leave a running game (players only)
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  const access = await authorizeGameAction(currentUser, 'game.leave', gameId);
  if ('response' in access) return access.response;
  const { game, role } = access;

  const result = await leaveGame(game, currentUser.id, role === 'leader');
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }

  await notifyTeams([game.teamId]);

  return NextResponse.json({ message: 'You left the game' });
});
