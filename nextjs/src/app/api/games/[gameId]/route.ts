/**
 * Game Detail API
 * Spec Reference: 16-games.md
 */

import { authorizeGameAction } from '@/app/api/games/game-access';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';
import {
  deleteGame,
  getGameWithMembers,
  isDeadlineBeforePreparation,
  isDeadlinePast,
  setGameDeadline,
} from '@/lib/db';
import { notifyTeams } from '@/lib/team-signals';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Check that a value is a real calendar date written as YYYY-MM-DD.
 *
 * @param value - The value from the request body.
 * @returns True for a date such as 2026-12-31, false for 2026-02-31 or a non-string.
 */
const isCalendarDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
};

/**
 * GET /api/games/[gameId] - Get a running game with its team's members
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  const access = await authorizeGameAction(currentUser, 'game.view', gameId, getGameWithMembers);
  if ('response' in access) return access.response;
  const { game } = access;

  return NextResponse.json({ game });
});

/**
 * PATCH /api/games/[gameId] - Configure a running game (leader only)
 * Spec: 16-games.md - Game Configuration
 */
export const PATCH = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  const access = await authorizeGameAction(currentUser, 'game.configure', gameId);
  if ('response' in access) return access.response;
  const { game } = access;

  const { deadline } = await request.json();
  if (deadline !== null && !isCalendarDate(deadline)) {
    return errorResponse('Deadline must be a valid date', 400);
  }

  if (deadline !== null && await isDeadlinePast(deadline)) {
    return errorResponse('Deadline cannot be in the past', 400);
  }

  // Spec: 16-games.md - Game Configuration. The last day cannot come before the preparation ends.
  if (deadline !== null && await isDeadlineBeforePreparation(gameId, deadline)) {
    return errorResponse('Deadline cannot be before the end of the preparation phase', 400);
  }

  const updated = await setGameDeadline(gameId, deadline);
  if (!updated) {
    return errorResponse('Only a running game can be configured', 400);
  }

  await notifyTeams([game.teamId]);

  return NextResponse.json({ message: 'Game configured successfully' });
});

/**
 * DELETE /api/games/[gameId] - Delete a game (leader only)
 * Spec: 16-games.md - Deleting a Game
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ gameId: string }>
) => {
  const { gameId } = await params;

  const access = await authorizeGameAction(currentUser, 'game.delete', gameId);
  if ('response' in access) return access.response;
  const { game } = access;

  await deleteGame(gameId);

  await notifyTeams([game.teamId]);

  return NextResponse.json({ message: 'Game deleted successfully' });
});
