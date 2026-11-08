/**
 * Add Prepared Resolution API
 * Spec Reference: 17-prepared-resolutions.md - Adding to Personal Resolutions
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorizeGameAction } from '@/app/api/games/game-access';
import { addPreparedResolutionToGame } from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/resolutions/prepared/[id]/add - Copy a pool entry into the caller's personal resolutions of a game
 * Body: { gameId: string }
 * Spec: 17-prepared-resolutions.md - Adding to Personal Resolutions
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ id: string }>
) => {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { gameId?: unknown };
  if (typeof body.gameId !== 'string' || body.gameId.length === 0) {
    return errorResponse('Game ID is required', 400);
  }

  // Spec: 21-authorization.md - game.propose: a player of a running game
  const access = await authorizeGameAction(currentUser, 'game.propose', body.gameId);
  if ('response' in access) return access.response;

  const result = await addPreparedResolutionToGame(id, currentUser.id, access.game.id);

  if ('id' in result) {
    return NextResponse.json({ id: result.id }, { status: 201 });
  }

  return result.error === 'not_found'
    ? errorResponse('Prepared resolution not found', 404)
    : errorResponse('You already have this resolution', 409);
});
