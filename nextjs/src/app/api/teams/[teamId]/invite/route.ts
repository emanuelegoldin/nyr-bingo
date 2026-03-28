/**
 * Team Invitation API
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */

import { NextRequest, NextResponse } from 'next/server';
import { createTeamInvitation, isTeamLeader, User } from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/teams/[teamId]/invite - Create team invitation
 * Spec: 04-bingo-teams.md - Team leader can invite users
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;
  const body = await request.json();
  const { email } = body;

  // Check if user is team leader
  // Spec: 04-bingo-teams.md - Only team leader can invite
  const isLeader = await isTeamLeader(teamId, currentUser.id);
  if (!isLeader) {
    return errorResponse('Only the team leader can invite users', 403);
  }

  const invitation = await createTeamInvitation(teamId, currentUser.id, email);

  if (!invitation) {
    return errorResponse('Failed to create invitation', 500);
  }

  return NextResponse.json({
    invitation,
    inviteUrl: `/join/${invitation.inviteCode}`,
  }, { status: 201 });
});