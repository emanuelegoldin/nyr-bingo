/**
 * Team Games API
 * Spec Reference: 16-games.md - Game Creation, Listing and Reading Games
 */

import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import { requirePermission } from '@/lib/authz';
import { createGame, getRunningGamesForTeam, getTeamMembers } from '@/lib/db';
import { notifyTeams } from '@/lib/team-signals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/teams/[teamId]/games - List the team's running games that the caller plays
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;

  const denied = await requirePermission(currentUser, 'team.view', { scope: 'team', teamId });
  if (denied) return denied;

  const games = await getRunningGamesForTeam(teamId, currentUser.id);

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
  const { teamId } = await params;

  // Spec: 21-authorization.md - game.create: a verified team leader
  const denied = await requirePermission(currentUser, 'game.create', { scope: 'team', teamId });
  if (denied) return denied;

  const { name, playerIds } = await request.json();
  if (typeof name !== 'string' || name.trim().length === 0) {
    return errorResponse('Game name is required', 400);
  }

  // Spec: 16-games.md - Game Creation. Without playerIds every member plays; the creator always does.
  const memberIds = (await getTeamMembers(teamId)).map((member) => member.userId);
  if (playerIds !== undefined) {
    const isValidList = Array.isArray(playerIds)
      && playerIds.every((id: unknown) => typeof id === 'string' && memberIds.includes(id));
    if (!isValidList) {
      return errorResponse('Players must be members of the team', 400);
    }
  }
  const players: string[] = playerIds === undefined ? memberIds : [currentUser.id, ...playerIds];

  const game = await createGame(teamId, name.trim(), players);

  await notifyTeams([teamId]);

  return NextResponse.json({ game }, { status: 201 });
});
