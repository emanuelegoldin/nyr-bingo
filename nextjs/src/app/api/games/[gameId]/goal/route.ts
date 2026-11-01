/**
 * Team Goal Resolution API
 * GET /api/games/[gameId]/goal - Get the game's team goal resolution with full details
 */

import { NextRequest, NextResponse } from 'next/server';
import { isTeamMember, getGameGoalResolution, getRunningGame } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/games/[gameId]/goal
 * Returns the team goal resolution with full type details (subtasks, repetitions, etc.)
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ gameId: string }>) => {
  const { gameId } = await params;

  const game = await getRunningGame(gameId);
  if (!game) {
    return errorResponse('Game not found', 404);
  }

  const member = await isTeamMember(game.teamId, currentUser.id);
  if (!member) {
    return errorResponse('You must be a team member', 403);
  }

  const goal = await getGameGoalResolution(gameId);
  if (!goal) {
    return NextResponse.json({ goal: null });
  }

  return NextResponse.json({
    goal: {
      id: goal.id,
      type: goal.resolutionType,
      ownerUserId: goal.ownerUserId,
      title: goal.title,
      text: goal.description ?? '',
      subtasks: goal.subtasks,
      numberOfRepetition: goal.numberOfRepetition,
      completedTimes: goal.completedTimes,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    },
  });
});
