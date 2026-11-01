/**
 * Team Join API (via invite code)
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */
import { NextRequest, NextResponse } from 'next/server';
import { notifications } from '@/lib/notifications';
import { notifyTeams } from '@/lib/team-signals';
import { isUserVerified } from '@/lib/auth';
import { joinTeamByInviteCode, getRunningGamesForTeam, getTeamWithMembers, ensureBingoCardForUser, GameStatus } from '@/lib/db';
import { errorResponse, withAuth, AuthContextNoParams } from '../utils';

/**
 * Give a new member a card in each started game of their team. A failure is logged and
 * does not affect the other games.
 * Spec: 16-games.md - Joining After Start
 * @param teamId The team joined
 * @param userId The new member
 */
async function generateCardsForNewMember(teamId: string, userId: string): Promise<void> {
  const games = await getRunningGamesForTeam(teamId);

  for (const game of games.filter((candidate) => candidate.status === GameStatus.STARTED)) {
    try {
      const { error } = await ensureBingoCardForUser(game.id, userId);
      if (error) {
        console.error('Failed to generate card for new member:', game.id, error);
      }
    } catch (error) {
      console.error('Failed to generate card for new member:', game.id, error);
    }
  }
}

/**
 * POST /api/join - Join a team using invite code
 * Spec: 04-bingo-teams.md - Invited users can accept/join the team
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  
  // Spec: 04-bingo-teams.md - Verification Requirement
  if (!isUserVerified(currentUser)) {
    return NextResponse.json(
      { error: 'Email verification required. Please verify your email before joining a team.' },
      { status: 403 }
    );
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

  if (result.team) {
    await generateCardsForNewMember(result.team.id, currentUser.id);
    await notifyTeams([result.team.id]);
    await notifications.publish({ type: 'member_joined', teamId: result.team.id, actorUserId: currentUser.id });
  }

  return NextResponse.json({
    message: 'Successfully joined the team',
    team: teamWithMembers,
  });
});
