/**
 * Review Thread API
 * Spec Reference: 07-proof-and-approval.md - Review Thread Model, Archived Threads
 */

import { authorizeThreadAction } from '@/app/api/threads/thread-access';
import { NextRequest, NextResponse } from 'next/server';
import { notifyCell } from '@/lib/team-signals';
import { deleteClosedThread, getThreadDetails } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/threads/[threadId] - Get thread details with messages, files, and votes
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ threadId: string }>) => {
  const { threadId } = await params;
  const access = await authorizeThreadAction(currentUser, 'thread.view', threadId);
  if ('response' in access) return access.response;

  const thread = await getThreadDetails(access.thread);
  if (!thread) {
    return errorResponse('Cell not found', 404);
  }
  return NextResponse.json({ thread });
});

/**
 * DELETE /api/threads/[threadId] - Delete a closed (archived) thread with its messages and files.
 * Only an admin of the game can delete it; an open thread cannot be deleted.
 * Spec: 07-proof-and-approval.md - Deleting an Archived Thread
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ threadId: string }>
) => {
  const { threadId } = await params;
  const access = await authorizeThreadAction(currentUser, 'thread.delete', threadId);
  if ('response' in access) return access.response;

  const result = await deleteClosedThread(threadId);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }
  // The cell is still there: signal its team so open game pages drop the thread
  await notifyCell(access.thread.cellId);
  return NextResponse.json({ success: true });
});
