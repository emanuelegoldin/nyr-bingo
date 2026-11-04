/**
 * Team Goal Resolution API
 * GET /api/games/[gameId]/goal - Get the game's team goal resolution with full details
 */

import { authorizeGameAction } from '@/app/api/games/game-access';
import { AuthContext, withAuth } from '@/app/api/utils';
import { getGameGoalResolution } from '@/lib/db';
import { toUnifiedResolution } from '@/lib/shared/resolution-form';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/games/[gameId]/goal
 * Returns the team goal resolution with full type details (subtasks, repetitions, etc.)
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ gameId: string }>) => {
  const { gameId } = await params;

  const access = await authorizeGameAction(currentUser, 'game.view', gameId);
  if ('response' in access) return access.response;

  const goal = await getGameGoalResolution(gameId);
  if (!goal) {
    return NextResponse.json({ goal: null });
  }

  return NextResponse.json({ goal: toUnifiedResolution(goal) });
});
