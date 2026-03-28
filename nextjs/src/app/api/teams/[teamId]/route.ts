/**
 * Team Detail API
 * Spec Reference: 04-bingo-teams.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTeamWithMembers, isTeamMember, deleteTeam, getTeamById, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '../../utils';

/**
 * GET /api/teams/[teamId] - Get a specific team's details
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;

  // Check if user is a member of the team
  const isMember = await isTeamMember(teamId, currentUser.id);
  if (!isMember) {
    return errorResponse('You are not a member of this team', 403);
  }

  const team = await getTeamWithMembers(teamId);

  if (!team) {
    return errorResponse('Team not found', 404);
  }

  return NextResponse.json({ team });
});

/**
 * DELETE /api/teams/[teamId] - Delete a team (leader only)
 * Spec Reference: 04-bingo-teams.md - Team leader can manage the team
 * 
 * Deletes the team and all associated data (memberships, invitations, 
 * resolutions, bingo cards) via CASCADE constraints.
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;

  // Check if team exists
  const team = await getTeamById(teamId);
  if (!team) {
    return NextResponse.json(
      { error: 'Team not found' },
      { status: 404 }
    );
  }

  // Attempt to delete (will check authorization internally)
  const deleted = await deleteTeam(teamId, currentUser.id);

  if (!deleted) {
    return NextResponse.json(
      { error: 'Only the team leader can delete the team' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    message: 'Team deleted successfully'
  });
});