/**
 * Teams API
 * Spec Reference: 04-bingo-teams.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUserVerified } from '@/lib/auth';
import {
  createTeam,
  getTeamsForUser,
  getTeamWithMembers,
  setTeamResolution,
  isTeamLeader,
} from '@/lib/db';
import { AuthContextNoParams, errorResponse, withAuth } from '@/app/api/utils';

/**
 * GET /api/teams - Get all teams for current user
 */
export const GET = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const teams = await getTeamsForUser(currentUser.id);

  // Get full team data with members for each team
  const teamsWithMembers = await Promise.all(
    teams.map(team => getTeamWithMembers(team.id))
  );

  return NextResponse.json({
    teams: teamsWithMembers.filter(t => t !== null)
  });
});

/**
 * POST /api/teams - Create a new team
 * Spec: 04-bingo-teams.md - A user can create a team and becomes team leader
 * Requires email verification
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  // Check if user has verified their email
  // Unverified users can only write resolutions and update their profiles
  if (!isUserVerified(currentUser)) {
    return errorResponse('Email verification required. Please verify your email before creating a team.', 403);
  }

  const body = await request.json();
  const { name } = body;

  if (!name || name.trim().length === 0) {
    return errorResponse('Team name is required', 400);
  }

  const team = await createTeam(name.trim(), currentUser.id);
  const teamWithMembers = await getTeamWithMembers(team.id);

  return NextResponse.json({ team: teamWithMembers }, { status: 201 });
});

/**
 * PUT /api/teams - Update team (set resolution, etc.)
 * Spec: 04-bingo-teams.md - Team leader can set team resolution
 */
export const PUT = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const body = await request.json();
  const { teamId, teamResolutionText } = body;

  if (!teamId) {
    return errorResponse('Team ID is required', 400);
  }

  // Check if user is team leader
  // Spec: 04-bingo-teams.md - Only team leader can set team resolution
  const isLeader = await isTeamLeader(teamId, currentUser.id);
  if (!isLeader) {
    return errorResponse('Only the team leader can update team settings', 403);
  }

  if (teamResolutionText !== undefined) {
    if (!teamResolutionText || teamResolutionText.trim().length === 0) {
      return errorResponse('Team resolution text is required', 400);
    }

    const team = await setTeamResolution(teamId, currentUser.id, teamResolutionText);

    if (!team) {
      return errorResponse('Failed to update team resolution', 500);
    }

    const teamWithMembers = await getTeamWithMembers(teamId);
    return NextResponse.json({ team: teamWithMembers });
  }

  return errorResponse('No update parameters provided', 400);
});