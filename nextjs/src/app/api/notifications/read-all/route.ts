/**
 * Mark All Notifications Read API
 * Spec Reference: 19-notifications.md - API
 */

import { NextRequest, NextResponse } from 'next/server';
import { markAllNotificationsRead } from '@/lib/notifications/repository';
import { withAuth, AuthContextNoParams } from '../../utils';

/**
 * POST /api/notifications/read-all - Mark all of the caller's notifications as read
 */
export const POST = withAuth(async (_request: NextRequest, { currentUser }: AuthContextNoParams) => {
  await markAllNotificationsRead(currentUser.id);
  return NextResponse.json({ message: 'All notifications marked as read' });
});
