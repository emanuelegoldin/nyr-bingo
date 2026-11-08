/**
 * Leave Game API
 * Spec Reference: 16-games.md - Leaving a Game, Automatic Start
 */

import { NextRequest, NextResponse } from 'next/server';
import { leaveGame } from '@/lib/db';
import { startGameIfAllReady } from '@/lib/game-starting';
import { GameStatus } from '@/lib/shared/types';
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

  // Spec: 16-games.md - Leaving a Game: the game starts if every remaining player is ready
  if (game.status === GameStatus.FORMING) {
    await startGameIfAllReady(game.id);
  }

  return NextResponse.json({ message: 'You left the game' });
});
