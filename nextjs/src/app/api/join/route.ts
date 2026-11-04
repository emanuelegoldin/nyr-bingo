/**
 * Team Join API (via invite code)
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */
import { requirePermission } from '@/lib/authz';
import {
  addPlayerToRunningGames,
  ensureBingoCardForUser,
  GameStatus,
  getRunningGamesForTeam,
  getTeamWithMembers,
  joinTeamByInviteCode,
} from '@/lib/db';
import { notifications } from '@/lib/notifications';
import { notifyTeams } from '@/lib/team-signals';
import { NextRequest, NextResponse } from 'next/server';
import { AuthContextNoParams, errorResponse, withAuth } from '../utils';

/**
 * Make a new member a player of each running game of their team, and give them a card in each
 * started one. A card failure is logged and does not affect the other games.
 * Spec: 16-games.md - Joining After Start
 * @param teamId The team joined
 * @param userId The new member
 */
async function addNewMemberToGames(teamId: string, userId: string): Promise<void> {
  await addPlayerToRunningGames(teamId, userId);
  const games = await getRunningGamesForTeam(teamId, userId);

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
  const denied = await requirePermission(currentUser, 'team.join', { scope: 'none' });
  if (denied) return denied;

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
    await addNewMemberToGames(result.team.id, currentUser.id);
    await notifyTeams([result.team.id]);
    await notifications.publish({ type: 'member_joined', teamId: result.team.id, actorUserId: currentUser.id });
  }

  return NextResponse.json({
    message: 'Successfully joined the team',
    team: teamWithMembers,
  });
});
