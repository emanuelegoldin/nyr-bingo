/**
 * Notifications API
 * Spec Reference: 19-notifications.md - API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserNotifications } from '@/lib/notifications/repository';
import { withAuth, AuthContextNoParams } from '../utils';

/**
 * GET /api/notifications - The caller's latest notifications and unread count
 */
export const GET = withAuth(async (_request: NextRequest, { currentUser }: AuthContextNoParams) => {
  return NextResponse.json(await getUserNotifications(currentUser.id));
});
