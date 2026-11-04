/**
 * Card Shuffle API
 * Spec Reference: 22-card-shuffle.md
 */

import { NextRequest } from 'next/server';
import { shuffleBingoCard } from '@/lib/db';
import { AuthContext, withAuth } from '@/app/api/utils';
import { arrangeOwnCard } from '../card-arrangement';

/**
 * POST /api/games/[gameId]/card/shuffle - Shuffle the caller's card while it is unlocked and has no done cell
 * Spec: 22-card-shuffle.md - Shuffle
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;
  return arrangeOwnCard(currentUser, gameId, shuffleBingoCard);
});
