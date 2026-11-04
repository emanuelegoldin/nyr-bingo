/**
 * Teams API
 * Spec Reference: 04-bingo-teams.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { createTeam, getTeamsForUser, getTeamWithMembers } from '@/lib/db';
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
  // Spec: 21-authorization.md - team.create requires a verified email
  const denied = await requirePermission(currentUser, 'team.create', { scope: 'none' });
  if (denied) return denied;

  const body = await request.json();
  const { name } = body;

  if (!name || name.trim().length === 0) {
    return errorResponse('Team name is required', 400);
  }

  const team = await createTeam(name.trim(), currentUser.id);
  const teamWithMembers = await getTeamWithMembers(team.id);

  return NextResponse.json({ team: teamWithMembers }, { status: 201 });
});
