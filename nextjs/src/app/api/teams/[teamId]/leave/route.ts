/**
 * Leave Team API
 * Spec Reference: 04-bingo-teams.md - Leaving a Team
 */

import { NextRequest, NextResponse } from 'next/server';
import { leaveTeam } from '@/lib/db';
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

  const result = await leaveTeam(teamId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }

  await notifyTeams([teamId]);

  return NextResponse.json({ message: 'You left the team' });
});
