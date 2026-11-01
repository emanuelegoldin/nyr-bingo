/**
 * Archived Games API
 * Spec Reference: 18-game-archive.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getArchivedGamesForUser } from '@/lib/db';
import { AuthContextNoParams, withAuth } from '@/app/api/utils';

/**
 * GET /api/archived-games - List the archived games the current user took part in
 */
export const GET = withAuth(async (_request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const archivedGames = await getArchivedGamesForUser(currentUser.id);

  return NextResponse.json({ archivedGames });
});
