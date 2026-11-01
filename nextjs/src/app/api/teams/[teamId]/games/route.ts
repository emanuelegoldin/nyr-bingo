/**
 * Team Games API
 * Spec Reference: 16-games.md - Game Creation, Listing and Reading Games
 */

import { NextRequest, NextResponse } from 'next/server';
import { notifyTeams } from '@/lib/team-signals';
import { isUserVerified } from '@/lib/auth';
import { createGame, getRunningGamesForTeam, isTeamLeader, isTeamMember } from '@/lib/db';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * GET /api/teams/[teamId]/games - List the team's running games
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;

  const isMember = await isTeamMember(teamId, currentUser.id);
  if (!isMember) {
    return errorResponse('You are not a member of this team', 403);
  }

  const games = await getRunningGamesForTeam(teamId);

  return NextResponse.json({ games });
});

/**
 * POST /api/teams/[teamId]/games - Create a game for the team
 * Spec: 16-games.md - Only a verified team leader can create a game
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  if (!isUserVerified(currentUser)) {
    return errorResponse('Email verification required. Please verify your email before creating a game.', 403);
  }

  const { teamId } = await params;

  const isLeader = await isTeamLeader(teamId, currentUser.id);
  if (!isLeader) {
    return errorResponse('Only the team leader can create a game', 403);
  }

  const { name } = await request.json();
  if (typeof name !== 'string' || name.trim().length === 0) {
    return errorResponse('Game name is required', 400);
  }

  const game = await createGame(teamId, name.trim());

  await notifyTeams([teamId]);

  return NextResponse.json({ game }, { status: 201 });
});
