/**
 * End Game API
 * Spec Reference: 16-games.md - Ending a Game
 */

import { NextRequest, NextResponse } from 'next/server';
import { notifyTeams, notifyThreadClosed } from '@/lib/team-signals';
import { closeOpenGameThreads, endGame, getRunningGame, isTeamLeader } from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/games/[gameId]/end - End a started game (leader only)
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

  const isLeader = await isTeamLeader(game.teamId, currentUser.id);
  if (!isLeader) {
    return errorResponse('Only the team leader can end the game', 403);
  }

  const ended = await endGame(gameId);
  if (!ended) {
    return errorResponse('Only a started game can be ended', 400);
  }

  const closedThreadIds = await closeOpenGameThreads(gameId);
  await Promise.all(closedThreadIds.map(notifyThreadClosed));
  await notifyTeams([game.teamId]);

  return NextResponse.json({ message: 'Game ended successfully' });
});
