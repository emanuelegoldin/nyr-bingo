/**
 * Notification Settings API
 * Spec Reference: 19-notifications.md - Settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNotificationsEnabled, setNotificationsEnabled } from '@/lib/notifications/repository';
import { errorResponse, withAuth, AuthContextNoParams } from '../../utils';

/**
 * GET /api/notifications/settings - Whether the caller has notifications on
 */
export const GET = withAuth(async (_request: NextRequest, { currentUser }: AuthContextNoParams) => {
  return NextResponse.json({ enabled: await getNotificationsEnabled(currentUser.id) });
});

/**
 * PUT /api/notifications/settings - Turn the caller's notifications on or off
 */
export const PUT = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const { enabled } = await request.json();
  if (typeof enabled !== 'boolean') {
    return errorResponse('enabled must be a boolean', 400);
  }

  await setNotificationsEnabled(currentUser.id, enabled);
  return NextResponse.json({ enabled });
});
