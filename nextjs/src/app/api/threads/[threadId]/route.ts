/**
 * Review Thread API
 * Spec Reference: Resolution Review & Proof Workflow - Review Thread
 */

import { authorizeThreadAction, authorizeThreadCompleter } from '@/app/api/threads/thread-access';
import { NextRequest, NextResponse } from 'next/server';
import { notifyThreadClosed } from '@/lib/team-signals';
import { closeThread, getThreadDetails } from '@/lib/db';
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
 * DELETE /api/threads/[threadId] - Close a review thread
 * Only the completing user can close an open thread
 */
export const DELETE = withAuth(async (
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
