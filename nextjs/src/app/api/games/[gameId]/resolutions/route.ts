/**
 * Member-Provided Resolutions API
 * Spec Reference: 16-games.md - Member-Provided Resolutions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isTeamMember,
  getMemberProvidedResolutionsByUser,
  getMemberProvidedResolutionsForUser,
  checkAllResolutionsProvided,
  getRunningGame,
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

  // Check if user is a member
  const isMember = await isTeamMember(game.teamId, currentUser.id);
  if (!isMember) {
    return errorResponse('You are not a member of this team', 403);
  }

  if (toUserId) {
    const resolutions = await getMemberProvidedResolutionsForUser(gameId, toUserId);
    return NextResponse.json({ resolutions });
  }

  // Get resolutions created by the user
  const createdByUser = await getMemberProvidedResolutionsByUser(gameId, currentUser.id);

  // Get resolutions created for the user
  const createdForUser = await getMemberProvidedResolutionsForUser(gameId, currentUser.id);

  // Get all team members
  const members = await getTeamMembers(game.teamId);

  // Check overall status
  const status = await checkAllResolutionsProvided(game);

  return NextResponse.json({
    createdByUser,
    createdForUser,
    members,
    status,
  });
});
