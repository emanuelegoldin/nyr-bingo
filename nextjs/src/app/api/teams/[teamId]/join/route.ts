/**
 * Team Join API
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUserVerified } from '@/lib/auth';
import { joinTeamByInviteCode, getTeamWithMembers, ensureBingoCardForUser, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/teams/[teamId]/join - Join a team using invite code
 * Spec: 04-bingo-teams.md - Invited users can accept/join the team
 * Requires email verification
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
    // Check if user has verified their email
  // Unverified users can only write resolutions and update their profiles
  if (!isUserVerified(currentUser)) {
    return errorResponse('Email verification required. Please verify your email before joining a team.', 403);
  }

  const body = await request.json();
  const { inviteCode } = body;

  if (!inviteCode) {
    return errorResponse('Invite code is required', 400);
  }

  const result = await joinTeamByInviteCode(inviteCode, currentUser.id);

  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  // Get full team data
  const teamWithMembers = result.team
    ? await getTeamWithMembers(result.team.id)
    : null;

  // Spec: 04-bingo-teams.md - Joining After Start
  if (result.team?.status === 'started') {
    const cardResult = await ensureBingoCardForUser(result.team.id, currentUser.id);
    if (cardResult && 'error' in cardResult && cardResult.error) {
      return errorResponse(cardResult.error, 400);
    }
  }

  return NextResponse.json({
    message: 'Successfully joined the team',
    team: teamWithMembers,
  });
});