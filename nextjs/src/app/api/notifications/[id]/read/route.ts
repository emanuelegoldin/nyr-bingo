/**
 * Mark Notification Read API
 * Spec Reference: 19-notifications.md - API
 */

import { NextRequest, NextResponse } from 'next/server';
import { markNotificationRead } from '@/lib/notifications/repository';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

/**
 * POST /api/notifications/[id]/read - Mark one of the caller's notifications as read
 */
export const POST = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ id: string }>
) => {
  const { id } = await params;
  if (!await markNotificationRead(id, currentUser.id)) {
    return errorResponse('Notification not found', 404);
  }
  return NextResponse.json({ message: 'Notification marked as read' });
});
