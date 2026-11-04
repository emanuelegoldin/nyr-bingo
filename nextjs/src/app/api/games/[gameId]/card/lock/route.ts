/**
 * Card Lock API
 * Spec Reference: 22-card-shuffle.md
 */

import { NextRequest } from 'next/server';
import { lockBingoCard } from '@/lib/db';
import { AuthContext, withAuth } from '@/app/api/utils';
import { arrangeOwnCard } from '../card-arrangement';

/**
 * POST /api/games/[gameId]/card/lock - Lock the caller's card so it can no longer be shuffled
 * Spec: 22-card-shuffle.md - Lock
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;
  return arrangeOwnCard(currentUser, gameId, lockBingoCard);
});
