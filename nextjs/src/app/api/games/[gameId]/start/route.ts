/**
 * Game Start Bingo API
 * Spec Reference: 16-games.md - Start Conditions
 */

import { authorizeGameAction } from '@/app/api/games/game-access';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import {
  checkGameCanStart,
  getGameWithMembers,
  initializeGameLeaderboard,
  startGameWithCards,
} from '@/lib/db';
import { notifications } from '@/lib/notifications';
import { notifyTeams } from '@/lib/team-signals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/games/[gameId]/start - Start the bingo game
 * Spec: 16-games.md - Team leader can start bingo once all members created resolutions
 * Requires email verification
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  // Spec: 21-authorization.md - game.start: a verified leader of the game. A missing game gives 404.
  const access = await authorizeGameAction(currentUser, 'game.start', gameId);
  if ('response' in access) return access.response;
  const runningGame = access.game;

  // Validate all start conditions
  const check = await checkGameCanStart(gameId);

  if (!check.success) {
    return errorResponse(check.error, 400);
  }

  // Start the game and generate bingo cards for all members
  // Spec: 05-bingo-card-generation.md - Cards generated automatically at start
  const result = await startGameWithCards(gameId);

  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  // Get updated game data
  const game = await getGameWithMembers(gameId);

  // Initialize persisted leaderboard rows for all team members
  if (game) {
    const memberIds = game.members.map((m) => m.user.userId);
    await initializeGameLeaderboard(game, memberIds);
  }

  await notifyTeams([runningGame.teamId]);
  await notifications.publish({ type: 'game_started', gameId, actorUserId: currentUser.id });

  return NextResponse.json({
    message: 'Bingo game started successfully',
    game,
  });
});