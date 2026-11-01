/**
 * Game Start Bingo API
 * Spec Reference: 16-games.md - Start Conditions
 */

import { NextRequest, NextResponse } from 'next/server';
import { notifications } from '@/lib/notifications';
import { notifyTeams } from '@/lib/team-signals';
import { isUserVerified } from '@/lib/auth';
import {
  checkGameCanStart,
  startGameWithCards,
  isTeamLeader,
  getGameWithMembers,
  getRunningGame,
  initializeGameLeaderboard,
} from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/games/[gameId]/start - Start the bingo game
 * Spec: 16-games.md - Team leader can start bingo once all members created resolutions
 * Requires email verification
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
    // Check if user has verified their email
  // Unverified users can only write resolutions and update their profiles
  if (!isUserVerified(currentUser)) {
    return errorResponse('Email verification required. Please verify your email before starting a game.', 403);
  }

  const { gameId } = await params;

  const runningGame = await getRunningGame(gameId);
  if (!runningGame) {
    return errorResponse('Game not found', 404);
  }

  // Check if user is team leader
  // Spec: 16-games.md - Only team leader can start game
  const isLeader = await isTeamLeader(runningGame.teamId, currentUser.id);
  if (!isLeader) {
    return errorResponse('Only the team leader can start the game', 403);
  }

  // Validate all start conditions
  const check = await checkGameCanStart(gameId, currentUser.id);

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