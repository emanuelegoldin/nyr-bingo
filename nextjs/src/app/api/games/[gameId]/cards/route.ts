/**
 * Game Bingo Cards API
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md, 08-visibility-and-updates.md
 */

import { authorizeGameAction } from '@/app/api/games/game-access';
import { AuthContext, withAuth } from '@/app/api/utils';
import {
  getBingoCard,
  getGameBingoCards,
} from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/games/[gameId]/cards - Get all bingo cards of the game
 * Spec: 08-visibility-and-updates.md - A team member can view bingo cards of other members
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ gameId: string }>) => {
  const { gameId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  // Spec: 08-visibility-and-updates.md - Only the game's players can view its cards
  const access = await authorizeGameAction(currentUser, 'game.view', gameId);
  if ('response' in access) return access.response;
  const { game } = access;

  if (userId) {
    // Get specific user's card
    const card = await getBingoCard(gameId, userId);
    return NextResponse.json({ card });
  }

  // Get all cards of the game
  const cards = await getGameBingoCards(gameId);

  return NextResponse.json({ cards });
});