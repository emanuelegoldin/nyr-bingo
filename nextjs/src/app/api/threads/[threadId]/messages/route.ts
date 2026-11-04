/**
 * Review Messages API
 * Spec Reference: Resolution Review & Proof Workflow - Thread Capabilities
 */

import { authorizeThreadAction } from '@/app/api/threads/thread-access';
import { NextRequest, NextResponse } from 'next/server';
import { notifyThread } from '@/lib/team-signals';
import { addMessage } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/threads/[threadId]/messages - Post a message to a thread
 * All players of the game can post messages
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ threadId: string }>
) => {
  const { threadId } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return errorResponse('Message content is required', 400);
  }

  const access = await authorizeThreadAction(currentUser, 'thread.message', threadId);
  if ('response' in access) return access.response;

  const result = await addMessage(threadId, currentUser.id, content);
  if (!result.success) {
    return errorResponse(result.error, result.status);
  }

  await notifyThread(threadId);

  return NextResponse.json({ message: result.message }, { status: 201 });
});