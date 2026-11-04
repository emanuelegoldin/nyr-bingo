/**
 * Leave Team API
 * Spec Reference: 04-bingo-teams.md - Leaving a Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { getTeamById, leaveTeam } from '@/lib/db';
import { notifyTeams } from '@/lib/team-signals';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/teams/[teamId]/leave - Leave a team and its running games (members only)
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;

  const team = await getTeamById(teamId);
  if (!team) {
    return errorResponse('Team not found', 404);
  }

  const denied = await requirePermission(currentUser, 'team.leave', { scope: 'team', teamId });
  if (denied) return denied;

  const result = await leaveTeam(teamId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }

  await notifyTeams([teamId]);

  return NextResponse.json({ message: 'You left the team' });
});
