/**
 * Ready API - a player signals they are done preparing, or no longer done
 * Spec Reference: 16-games.md - Ready, Automatic Start
 */

import { authorizeGameAction } from '@/app/api/games/game-access';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import { setPlayerReady } from '@/lib/db';
import { startGameIfAllReady } from '@/lib/game-starting';
import { notifyTeams } from '@/lib/team-signals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/games/[gameId]/ready - Mark the caller ready or not ready. The last player to become ready starts the game.
 * Body: { ready: boolean }
 * Returns { ready, started }.
 * Spec: 16-games.md - Ready
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  // Spec: 21-authorization.md - game.ready: any player of a running game
  const access = await authorizeGameAction(currentUser, 'game.ready', gameId);
  if ('response' in access) return access.response;

  const body = (await request.json().catch(() => ({}))) as { ready?: unknown };
  if (typeof body.ready !== 'boolean') {
    return errorResponse('ready must be true or false', 400);
  }

  const changed = await setPlayerReady(gameId, currentUser.id, body.ready);
  if (!changed) {
    return errorResponse('The game is no longer in preparation', 400);
  }

  // A failed start is retried by the sweep, so it does not fail the request (spec 16)
  const started = body.ready && await startGameIfAllReady(gameId);
  if (!started) {
    await notifyTeams([access.game.teamId]);
  }

  return NextResponse.json({ ready: body.ready, started });
});
