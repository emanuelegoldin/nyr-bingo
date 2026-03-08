/**
 * Team Goal Resolution API
 * GET /api/teams/[teamId]/goal - Get the team goal resolution with full details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { isTeamMember, getTeamGoalResolution } from '@/lib/db';

/**
 * GET /api/teams/[teamId]/goal
 * Returns the team goal resolution with full type details (subtasks, repetitions, etc.)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { teamId } = await params;

    const member = await isTeamMember(teamId, currentUser.id);
    if (!member) {
      return NextResponse.json({ error: 'You must be a team member' }, { status: 403 });
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
  } catch (error) {
    console.error('Get team goal error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
