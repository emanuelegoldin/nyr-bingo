/**
 * Review Messages API
 * Spec Reference: Resolution Review & Proof Workflow - Thread Capabilities
 */

import { NextRequest, NextResponse } from 'next/server';
import { addMessage, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/threads/[threadId]/messages - Post a message to a thread
 * All team members can post messages
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

  const result = await addMessage(threadId, currentUser.id, content);
  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  return NextResponse.json({ message: result.message }, { status: 201 });
});