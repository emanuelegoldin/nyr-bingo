/**
 * Signed tokens that let a client join a WebSocket room (spec 11).
 * ws-server checks them with the shared secret, so it never needs the database.
 */

import { createHmac } from 'crypto';
import type { WsRoom } from './shared/ws-messages';

const TOKEN_LIFETIME_MS = 5 * 60 * 1000;

/**
 * Sign a token for one room.
 *
 * @param room - The room the holder may join.
 * @param secret - The secret shared with ws-server.
 * @returns The token, as `<base64url payload>.<base64url signature>`.
 */
export function createRoomToken(room: WsRoom, secret: string): string {
  const payload = Buffer
    .from(JSON.stringify({ type: room.type, id: room.id, exp: Date.now() + TOKEN_LIFETIME_MS }))
    .toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}
