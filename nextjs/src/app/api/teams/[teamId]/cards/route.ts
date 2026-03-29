/**
 * Team Bingo Cards API
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md, 08-visibility-and-updates.md
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  isTeamMember,
  getTeamBingoCards,
  getBingoCard,
  User,
} from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/teams/[teamId]/cards - Get all bingo cards for the team
 * Spec: 08-visibility-and-updates.md - A team member can view bingo cards of other members
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ teamId: string }>) => {
  const { teamId } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  // Check if user is a member
  // Spec: 08-visibility-and-updates.md - Only team members can view team cards
  const isMember = await isTeamMember(teamId, currentUser.id);
  if (!isMember) {
    return errorResponse('You are not a member of this team', 403);
  }

  if (userId) {
    // Get specific user's card
    const card = await getBingoCard(teamId, userId);
    return NextResponse.json({ card });
  }

  // Get all cards for the team
  const cards = await getTeamBingoCards(teamId, currentUser.id);

  return NextResponse.json({ cards });
});