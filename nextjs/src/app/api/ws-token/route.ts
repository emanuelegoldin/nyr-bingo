/**
 * WebSocket Room Token API
 * Spec Reference: 11-real-time-card-updates.md
 */

import { authorizeThreadAction } from '@/app/api/threads/thread-access';
import { authorize, getResolutionHistoryAccess } from '@/lib/authz';
import type { User } from '@/lib/db';
import type { WsRoom } from '@/lib/shared/ws-messages';
import { createRoomToken } from '@/lib/ws-token';
import { NextRequest, NextResponse } from 'next/server';
import { AuthContextNoParams, errorResponse, withAuth } from '../utils';

/**
 * Whether a user may watch a room. A room shows the same data as the page behind it.
 *
 * @param room - The room to join.
 * @param user - The user asking.
 * @returns True if the user may join.
 */
async function canJoinRoom(room: WsRoom, user: User): Promise<boolean> {
  if (room.type === 'user') return room.id === user.id;
  // Spec: 21-authorization.md - Known Gaps: card rooms are joined by team membership
  if (room.type === 'card') return (await authorize(user, 'team.view', { scope: 'team', teamId: room.id })).allowed;
  if (room.type === 'thread') return !('response' in await authorizeThreadAction(user, 'thread.view', room.id));
  return (await getResolutionHistoryAccess(room.id, user.id)).canView;
}

/**
 * GET /api/ws-token?type=card|thread|resolution|user&id=... - Get a token to join a room
 */
export const GET = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const type = request.nextUrl.searchParams.get('type');
  const id = request.nextUrl.searchParams.get('id');
  if (!id || (type !== 'card' && type !== 'thread' && type !== 'resolution' && type !== 'user')) {
    return errorResponse('A room type and id are required', 400);
  }

  const secret = process.env.WS_SHARED_SECRET;
  if (!secret) {
    return errorResponse('Live updates are not configured', 503);
  }

  const room: WsRoom = { type, id };
  if (!await canJoinRoom(room, currentUser)) {
    return errorResponse('You are not allowed to join this room', 403);
  }

  return NextResponse.json({ token: createRoomToken(room, secret) });
});
