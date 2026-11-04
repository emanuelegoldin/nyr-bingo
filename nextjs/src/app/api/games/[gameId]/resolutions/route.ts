/**
 * Member-Provided Resolutions API
 * Spec Reference: 16-games.md - Member-Provided Resolutions
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import {
  getMemberProvidedResolutionsByUser,
  getMemberProvidedResolutionsForUser,
  checkAllResolutionsProvided,
  getRunningGame,
  getGamePlayerIds,
  getTeamMembers,
} from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * GET /api/games/[gameId]/resolutions - Get resolutions status
 * Returns resolutions created by the user and for the user
 */
export const GET = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;
  // Optional query: return resolutions targeted to a given toUserId
  // Spec: 09-bingo-card-editing.md - Replacement Options
  const toUserId = request.nextUrl.searchParams.get('toUserId');

  const game = await getRunningGame(gameId);
  if (!game) {
    return errorResponse('Game not found', 404);
  }

  const denied = await requirePermission(currentUser, 'game.view', { scope: 'game', game });
  if (denied) return denied;

  if (toUserId) {
    const resolutions = await getMemberProvidedResolutionsForUser(gameId, toUserId);
    return NextResponse.json({ resolutions });
  }

  // Get resolutions created by the user
  const createdByUser = await getMemberProvidedResolutionsByUser(gameId, currentUser.id);

  // Get resolutions created for the user
  const createdForUser = await getMemberProvidedResolutionsForUser(gameId, currentUser.id);

  // Spec: 16-games.md - the members of a game are its players
  const playerIds = new Set(await getGamePlayerIds(game.id));
  const members = (await getTeamMembers(game.teamId)).filter((member) => playerIds.has(member.userId));

  // Check overall status
  const status = await checkAllResolutionsProvided(game);

  return NextResponse.json({
    createdByUser,
    createdForUser,
    members,
    status,
  });
});
