/**
 * Personal Resolutions of a Game API - the caller's own resolutions for a game
 * Spec Reference: 03-personal-resolutions.md - Read, 09-bingo-card-editing.md - Replacement Options
 */

import { authorizeGameAction } from '@/app/api/games/game-access';
import { AuthContext, withAuth } from '@/app/api/utils';
import { getPlayerGameResolutions } from '@/lib/db';
import { toUnifiedResolution } from '@/lib/shared/resolution-form';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/games/[gameId]/personal-resolutions - List the caller's personal resolutions of the game, newest first
 * Spec: 03-personal-resolutions.md - Read
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  // Spec: 21-authorization.md - game.view: players only; a missing or ended game gives 404
  const access = await authorizeGameAction(currentUser, 'game.view', gameId);
  if ('response' in access) return access.response;

  const resolutions = await getPlayerGameResolutions(gameId, currentUser.id);
  return NextResponse.json({ resolutions: resolutions.map(toUnifiedResolution) });
});
