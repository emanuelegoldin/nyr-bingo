/**
 * Game Bingo Cards API
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md, 08-visibility-and-updates.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/authz';
import {
  getGameBingoCards,
  getBingoCard,
  getRunningGame,
} from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/games/[gameId]/cards - Get all bingo cards of the game
 * Spec: 08-visibility-and-updates.md - A team member can view bingo cards of other members
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ gameId: string }>) => {
  const { gameId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  const game = await getRunningGame(gameId);
  if (!game) {
    return errorResponse('Game not found', 404);
  }

  // Spec: 08-visibility-and-updates.md - Only the game's players can view its cards
  const denied = await requirePermission(currentUser, 'game.view', { scope: 'game', game });
  if (denied) return denied;

  if (userId) {
    // Get specific user's card
    const card = await getBingoCard(gameId, userId);
    return NextResponse.json({ card });
  }

  // Get all cards of the game
  const cards = await getGameBingoCards(gameId);

  return NextResponse.json({ cards });
});