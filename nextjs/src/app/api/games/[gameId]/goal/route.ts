/**
 * Team Goal Resolution API
 * GET /api/games/[gameId]/goal - Get the game's team goal resolution with full details
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { getGameGoalResolution, getRunningGame } from '@/lib/db';
import { toUnifiedResolution } from '@/lib/shared/resolution-form';
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

  const denied = await requirePermission(currentUser, 'game.view', { scope: 'game', game });
  if (denied) return denied;

  const goal = await getGameGoalResolution(gameId);
  if (!goal) {
    return NextResponse.json({ goal: null });
  }

  return NextResponse.json({ goal: toUnifiedResolution(goal) });
});
