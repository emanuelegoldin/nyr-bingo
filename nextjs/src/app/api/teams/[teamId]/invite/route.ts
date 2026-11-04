/**
 * Team Invitation API
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import { createTeamInvitation } from '@/lib/db';
import { AuthContext, withAuth } from '@/app/api/utils';

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

  // Spec: 04-bingo-teams.md - Only team leader can invite
  const denied = await requirePermission(currentUser, 'team.invite', { scope: 'team', teamId });
  if (denied) return denied;

  const invitation = await createTeamInvitation(teamId, email);

  return NextResponse.json({
    invitation,
    inviteUrl: `/join/${invitation.inviteCode}`,
  }, { status: 201 });
});