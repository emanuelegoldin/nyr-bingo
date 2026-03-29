/**
 * Review Thread API
 * Spec Reference: Resolution Review & Proof Workflow - Review Thread
 */

import { NextRequest, NextResponse } from 'next/server';
import { closeThread, getThreadById, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * GET /api/threads/[threadId] - Get thread details with messages, files, and votes
 */
export const GET = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ threadId: string }>) => {
  const { threadId } = await params;
  const result = await getThreadById(threadId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error!, result.error === 'Thread not found' ? 404 : 403);
  }
  return NextResponse.json({ thread: result.thread });
});

/**
 * DELETE /api/threads/[threadId] - Close a review thread
 * Only the resolution owner can close an open thread
 */
export const DELETE = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ threadId: string }>
) => {
  const { threadId } = await params;
  const result = await closeThread(threadId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error!, result.error === 'Thread not found' ? 404 : 403);
  }
  return NextResponse.json({ success: true });
});
