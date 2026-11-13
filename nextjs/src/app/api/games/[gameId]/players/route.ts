/**
 * Game Players API - an admin invites a team member to a running game
 * Spec Reference: 16-games.md - Inviting a Player
 */

import { authorizeGameAction } from '@/app/api/games/game-access';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import { addPlayerToGame, ensureBingoCardForUser, GameStatus, isTeamMember } from '@/lib/db';
import { notifications } from '@/lib/notifications';
import { notifyTeams } from '@/lib/team-signals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Give a newly invited player a card in a started game. A failure is logged and not reported.
 * Spec: 16-games.md - Inviting a Player
 * @param gameId The started game
 * @param userId The invited player
 */
async function generateInvitedPlayerCard(gameId: string, userId: string): Promise<void> {
  try {
    const { error } = await ensureBingoCardForUser(gameId, userId);
    if (error) {
      console.error('Failed to generate card for invited player:', gameId, error);
    }
  } catch (error) {
    console.error('Failed to generate card for invited player:', gameId, error);
  }
}

/**
 * POST /api/games/[gameId]/players - Invite a team member who is not a player (admin only)
 * Body: { userId }
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  const access = await authorizeGameAction(currentUser, 'game.invite', gameId);
  if ('response' in access) return access.response;
  const { game } = access;

  const body = await request.json().catch(() => ({}));
  const userId: unknown = body?.userId;
  if (typeof userId !== 'string' || userId.length === 0) {
    return errorResponse('userId is required', 400);
  }

  if (!(await isTeamMember(game.teamId, userId))) {
    return errorResponse('Only a member of the team can be invited', 400);
  }

  const added = await addPlayerToGame(game.id, userId);
  if (!added) {
    return errorResponse('This member already plays the game', 400);
  }

  if (game.status === GameStatus.STARTED) {
    await generateInvitedPlayerCard(game.id, userId);
  }

  await notifyTeams([game.teamId]);
  await notifications.publish({ type: 'game_invited', gameId: game.id, actorUserId: currentUser.id, targetUserId: userId });

  return NextResponse.json({ message: 'Player invited' });
});
