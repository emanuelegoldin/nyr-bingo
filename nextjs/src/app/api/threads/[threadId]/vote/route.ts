/**
 * Review Vote API
 * Spec Reference: Resolution Review & Proof Workflow - Voting Rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitVote } from '@/lib/db';
import type { VoteType } from '@/lib/db/types';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/threads/[threadId]/vote - Submit or update a vote
 * All team members except the completing user can vote
 */
export const POST = withAuth(async (request: NextRequest, { params, currentUser }: AuthContext<{ threadId: string }>) => {
    const { threadId } = await params;
    const body = await request.json();
    const { vote } = body;

    // Validate vote
    if (!vote || !['accept', 'deny'].includes(vote)) {
      return errorResponse('Vote must be "accept" or "deny"', 400);
    }
    const result = await submitVote(threadId, currentUser.id, vote as VoteType);
    if (!result.success) {
      return errorResponse(result.error!, 400);
    }

    // Return vote and whether the thread was closed
    return NextResponse.json({ 
      vote: result.vote,
      threadClosed: result.threadClosed,
    }, { status: 201 });
});
