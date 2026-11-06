/**
 * Review Thread Close API
 * Spec Reference: 07-proof-and-approval.md - Closure by the Completing User
 */

import { authorizeThreadCompleter } from '@/app/api/threads/thread-access';
import { NextRequest, NextResponse } from 'next/server';
import { notifyThreadClosed } from '@/lib/team-signals';
import { closeThread } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/threads/[threadId]/close - Close a review thread; its cell returns to pending.
 * Only the completing user can close an open thread.
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ threadId: string }>
) => {
  const { threadId } = await params;
  const access = await authorizeThreadCompleter(currentUser, threadId, 'Only the completing user can close the thread');
  if ('response' in access) return access.response;

  const result = await closeThread(threadId);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }
  await notifyThreadClosed(threadId);
  return NextResponse.json({ success: true });
});
