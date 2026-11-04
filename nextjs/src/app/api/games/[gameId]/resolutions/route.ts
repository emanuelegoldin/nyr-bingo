/**
 * Member-Provided Resolutions API
 * Spec Reference: 16-games.md - Member-Provided Resolutions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getMemberProvidedResolutionsByUser,
  getMemberProvidedResolutionsForUser,
  checkAllResolutionsProvided,
  getGamePlayerIds,
  getTeamMembers,
} from '@/lib/db';
import { AuthContext, withAuth } from '@/app/api/utils';
import { authorizeGameAction } from '@/app/api/games/game-access';

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

  const access = await authorizeGameAction(currentUser, 'game.view', gameId);
  if ('response' in access) return access.response;
  const { game } = access;

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
