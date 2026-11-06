/**
 * Cell Reaction API
 * Spec Reference: 24-cell-reactions.md - Backend Rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { authorize, isCardOwner } from '@/lib/authz';
import {
  getCellReactionTarget,
  getRunningGame,
  removeCellReaction,
  setCellReaction,
  type User,
} from '@/lib/db';
import { isReactionId, REACTABLE_CELL_STATES } from '@/lib/shared/reactions';
import { notifyCell } from '@/lib/team-signals';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * Check that the caller may react to a cell, in the order of spec 24: the cell exists and is not
 * the Joker, its game is running, the caller holds `cell.react` there, does not own the card, and
 * the cell is stamped. Like every cell route, refusals are 400 (spec 21 - Status Rules).
 *
 * @param user - The logged-in user.
 * @param cellId - The cell.
 * @returns The 400 response refusing the reaction, or null when the caller may react.
 */
const checkReactionAccess = async (user: User, cellId: string): Promise<NextResponse | null> => {
  const target = cellId.startsWith('joker:') ? null : await getCellReactionTarget(cellId);
  if (!target) {
    return errorResponse('Cell not found', 400);
  }

  const game = await getRunningGame(target.gameId);
  const decision = await authorize(user, 'cell.react', { scope: 'game', game });
  if (!decision.allowed) {
    return errorResponse(decision.error, 400);
  }

  if (isCardOwner(target.cardUserId, user.id)) {
    return errorResponse('You cannot react to your own cells', 400);
  }
  if (!REACTABLE_CELL_STATES.includes(target.state)) {
    return errorResponse('Only completed or accomplished cells can get reactions', 400);
  }
  return null;
};

/**
 * PUT /api/cells/[cellId]/reaction - Add or change the caller's reaction, at a new random placement
 * Spec: 24-cell-reactions.md - Adding, Changing and Removing
 */
export const PUT = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;

  const denied = await checkReactionAccess(currentUser, cellId);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  const reaction = typeof body === 'object' && body !== null ? (body as { reaction?: unknown }).reaction : undefined;
  if (!isReactionId(reaction)) {
    return errorResponse('Unknown reaction', 400);
  }

  const stored = await setCellReaction(cellId, currentUser.id, reaction);
  if (!stored) {
    return errorResponse('Cell state has changed — please refresh and try again', 400);
  }

  await notifyCell(cellId);
  return NextResponse.json({ reaction: stored });
});

/**
 * DELETE /api/cells/[cellId]/reaction - Remove the caller's reaction, if any
 * Spec: 24-cell-reactions.md - Adding, Changing and Removing
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;

  const denied = await checkReactionAccess(currentUser, cellId);
  if (denied) return denied;

  if (await removeCellReaction(cellId, currentUser.id)) {
    await notifyCell(cellId);
  }
  return NextResponse.json({ success: true });
});
