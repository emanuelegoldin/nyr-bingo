/**
 * Shared handler of the card shuffle and lock routes.
 * Spec Reference: 22-card-shuffle.md
 */

import { NextResponse } from 'next/server';
import { getBingoCard, type CardArrangementResult, type User } from '@/lib/db';
import { notifyTeams } from '@/lib/team-signals';
import { errorResponse } from '@/app/api/utils';
import { authorizeGameAction } from '@/app/api/games/game-access';

/**
 * Run a shuffle or a lock on the caller's own card in a game, then signal the team and return the card.
 * @param currentUser The logged-in user, who owns the card
 * @param gameId The game
 * @param arrange The repository change to run on the card
 * @returns `{ card }`, or the refusal: 404 for a missing or ended game or no card, 403 for a non-player, 400 otherwise
 */
export async function arrangeOwnCard(
  currentUser: User,
  gameId: string,
  arrange: (gameId: string, userId: string) => Promise<CardArrangementResult>
): Promise<NextResponse> {
  const access = await authorizeGameAction(currentUser, 'card.arrange', gameId);
  if ('response' in access) return access.response;
  const { game } = access;

  const result = await arrange(game.id, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }

  await notifyTeams([game.teamId]);

  const card = await getBingoCard(game.id, currentUser.id);
  return NextResponse.json({ card });
}
