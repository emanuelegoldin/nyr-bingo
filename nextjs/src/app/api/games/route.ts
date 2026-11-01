/**
 * Games API
 * Spec Reference: 16-games.md - Listing and Reading Games
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRunningGamesForUser } from '@/lib/db';
import { AuthContextNoParams, withAuth } from '@/app/api/utils';

/**
 * GET /api/games - List the running games of the current user's teams
 */
export const GET = withAuth(async (_request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const games = await getRunningGamesForUser(currentUser.id);

  return NextResponse.json({ games });
});
