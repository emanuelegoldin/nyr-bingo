/**
 * Team Goal Resolution API
 * GET /api/teams/[teamId]/goal - Get the team goal resolution with full details
 */

import { NextRequest, NextResponse } from 'next/server';
import { isTeamMember, getTeamGoalResolution, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/teams/[teamId]/goal
 * Returns the team goal resolution with full type details (subtasks, repetitions, etc.)
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ teamId: string }>) => {
  const { teamId } = await params;

  const member = await isTeamMember(teamId, currentUser.id);
  if (!member) {
    return errorResponse('You must be a team member', 403);
  }

  const goal = await getTeamGoalResolution(teamId);
  if (!goal) {
    return NextResponse.json({ goal: null });
  }

  return NextResponse.json({
    goal: {
      id: goal.id,
      type: goal.resolutionType,
      ownerUserId: goal.ownerUserId,
      title: goal.title,
      text: goal.description ?? '',
      subtasks: goal.subtasks,
      numberOfRepetition: goal.numberOfRepetition,
      completedTimes: goal.completedTimes,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    },
  });
});
