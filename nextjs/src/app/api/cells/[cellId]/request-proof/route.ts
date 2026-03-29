/**
 * Request Proof API
 * Spec Reference: Resolution Review & Proof Workflow - Request Proof
 */

import { NextRequest, NextResponse } from 'next/server';
import { requestProof, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/cells/[cellId]/request-proof - Request proof for a completed cell
 * Creates a review thread for the cell
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ cellId: string }>
) => {
  const { cellId } = await params;
  const result = await requestProof(cellId, currentUser.id);
  if (!result.success) {
    return errorResponse(result.error, 400);
  }
  return NextResponse.json({ thread: result.thread }, { status: 201 });
});
