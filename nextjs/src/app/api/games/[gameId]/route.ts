/**
 * Game Detail API
 * Spec Reference: 16-games.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGameWithMembers, isTeamMember } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/games/[gameId] - Get a running game with its team's members
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  const game = await getGameWithMembers(gameId);
  if (!game) {
    return errorResponse('Game not found', 404);
  }

  const isMember = await isTeamMember(game.teamId, currentUser.id);
  if (!isMember) {
    return errorResponse('You are not a member of this team', 403);
  }

  return NextResponse.json({ game });
});
