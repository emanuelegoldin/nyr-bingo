/**
 * WebSocket Room Token API
 * Spec Reference: 11-real-time-card-updates.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { getResolutionHistoryAccess, getThreadById, isTeamMember } from '@/lib/db';
import type { WsRoom } from '@/lib/shared/ws-messages';
import { createRoomToken } from '@/lib/ws-token';
import { errorResponse, withAuth, AuthContextNoParams } from '../utils';

/**
 * Whether a user may watch a room. A room shows the same data as the page behind it.
 *
 * @param room - The room to join.
 * @param userId - The user asking.
 * @returns True if the user may join.
 */
async function canJoinRoom(room: WsRoom, userId: string): Promise<boolean> {
  if (room.type === 'card') return isTeamMember(room.id, userId);
  if (room.type === 'thread') return (await getThreadById(room.id, userId)).success;
  return (await getResolutionHistoryAccess(room.id, userId)).canView;
}

/**
 * GET /api/ws-token?type=card|thread|resolution&id=... - Get a token to join a room
 */
export const GET = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
  const type = request.nextUrl.searchParams.get('type');
  const id = request.nextUrl.searchParams.get('id');
  if (!id || (type !== 'card' && type !== 'thread' && type !== 'resolution')) {
    return errorResponse('A room type and id are required', 400);
  }

  const secret = process.env.WS_SHARED_SECRET;
  if (!secret) {
    return errorResponse('Live updates are not configured', 503);
  }

  const room: WsRoom = { type, id };
  if (!await canJoinRoom(room, currentUser.id)) {
    return errorResponse('You are not allowed to join this room', 403);
  }

  return NextResponse.json({ token: createRoomToken(room, secret) });
});
