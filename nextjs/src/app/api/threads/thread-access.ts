/**
 * Access checks shared by the review thread routes.
 * Spec Reference: 07-proof-and-approval.md, 21-authorization.md - Status Rules
 */

import type { NextResponse } from 'next/server';
import { errorResponse } from '@/app/api/utils';
import { getGameIdForCell, isThreadCompleter, requirePermission } from '@/lib/authz';
import type { GamePermission } from '@/lib/authz/permissions';
import { getGameById, loadThread, type ReviewThread, type User } from '@/lib/db';

/** A thread the caller may act on, or the response refusing the action. */
export type ThreadAccess = { thread: ReviewThread } | { response: NextResponse };

/**
 * Load a thread and check that the caller holds a permission in its game.
 * The game is resolved whatever its status; game status rules are checked by the repositories.
 * @param user The logged-in user
 * @param permission The thread permission asked for
 * @param threadId The thread
 * @returns The thread, or a 404 (missing thread or cell) or 403 (not a player) response
 */
export async function authorizeThreadAction(
  user: User,
  permission: Extract<GamePermission, `thread.${string}`>,
  threadId: string
): Promise<ThreadAccess> {
  const thread = await loadThread(threadId);
  if (!thread) {
    return { response: errorResponse('Thread not found', 404) };
  }

  const gameId = await getGameIdForCell(thread.cellId);
  const game = gameId ? await getGameById(gameId) : null;
  if (!game) {
    return { response: errorResponse('Cell not found', 404) };
  }

  const denied = await requirePermission(user, permission, { scope: 'game', game });
  return denied ? { response: denied } : { thread };
}

/**
 * Load a thread and check that the caller is its completing user.
 * Spec: 21-authorization.md - Resource Rules (Ownership)
 * @param user The logged-in user
 * @param threadId The thread
 * @param notCompleterError The message when the caller is someone else
 * @returns The thread, or a 404 (missing thread) or 403 (not the completing user) response
 */
export async function authorizeThreadCompleter(
  user: User,
  threadId: string,
  notCompleterError: string
): Promise<ThreadAccess> {
  const thread = await loadThread(threadId);
  if (!thread) {
    return { response: errorResponse('Thread not found', 404) };
  }
  if (!isThreadCompleter(thread, user.id)) {
    return { response: errorResponse(notCompleterError, 403) };
  }
  return { thread };
}
