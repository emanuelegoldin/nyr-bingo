/**
 * Team Leaders API
 * Spec Reference: 04-bingo-teams.md - Leaders
 */

import { NextRequest, NextResponse } from 'next/server';
import { notifyTeams } from '@/lib/team-signals';
import { requirePermission } from '@/lib/authz';
import { getTeamById, promoteToLeader } from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/teams/[teamId]/leaders - Make a team member a leader (leaders only)
 * Body: { userId }
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;

  const team = await getTeamById(teamId);
  if (!team) {
    return errorResponse('Team not found', 404);
  }

  const denied = await requirePermission(currentUser, 'team.promote', { scope: 'team', teamId });
  if (denied) return denied;

  const { userId } = await request.json();
  if (typeof userId !== 'string' || userId.length === 0) {
    return errorResponse('User ID is required', 400);
  }

  const result = await promoteToLeader(teamId, userId);
  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  await notifyTeams([teamId]);

  return NextResponse.json({ message: 'Member promoted to leader' });
});
