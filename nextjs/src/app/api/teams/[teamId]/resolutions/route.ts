/**
 * Team Provided Resolutions API
 * Spec Reference: 04-bingo-teams.md - Member-Provided Resolutions
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isTeamMember,
  createTeamProvidedResolution,
  getTeamProvidedResolutionsByUser,
  getTeamProvidedResolutionsForUser,
  checkAllResolutionsProvided,
  getTeamMembers,
} from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * GET /api/teams/[teamId]/resolutions - Get resolutions status
 * Returns resolutions created by the user and for the user
 */
export const GET = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;
  // Optional query: return resolutions targeted to a given toUserId
  // Spec: 09-bingo-card-editing.md - Replacement Options
  const toUserId = request.nextUrl.searchParams.get('toUserId');

  // Check if user is a member
  const isMember = await isTeamMember(teamId, currentUser.id);
  if (!isMember) {
    return errorResponse('You are not a member of this team', 403);
  }

  if (toUserId) {
    const resolutions = await getTeamProvidedResolutionsForUser(teamId, toUserId);
    return NextResponse.json({ resolutions });
  }

  // Get resolutions created by the user
  const createdByUser = await getTeamProvidedResolutionsByUser(teamId, currentUser.id);

  // Get resolutions created for the user
  const createdForUser = await getTeamProvidedResolutionsForUser(teamId, currentUser.id);

  // Get all team members
  const members = await getTeamMembers(teamId);

  // Check overall status
  const status = await checkAllResolutionsProvided(teamId);

  return NextResponse.json({
    createdByUser,
    createdForUser,
    members,
    status,
  });
});

/**
 * POST /api/teams/[teamId]/resolutions - Create resolution for another member
 * Spec: 04-bingo-teams.md - Each member can create a resolution for each other member
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;
  const body = await request.json();
  const { toUserId, text } = body;

  if (!toUserId) {
    return errorResponse('Target user ID is required', 400);
  }

  if (!text || text.trim().length === 0) {
    return errorResponse('Resolution text is required', 400);
  }

  // Spec: 04-bingo-teams.md - A member cannot create a "for myself" entry
  if (toUserId === currentUser.id) {
    return errorResponse('You cannot create a resolution for yourself', 400);
  }

  const resolution = await createTeamProvidedResolution(
    teamId,
    currentUser.id,
    toUserId,
    text
  );

  if (!resolution) {
    return errorResponse('Failed to create resolution. Check that both users are team members.', 400);
  }

  // Get updated status
  const status = await checkAllResolutionsProvided(teamId);

  return NextResponse.json({ resolution, status }, { status: 201 });
});