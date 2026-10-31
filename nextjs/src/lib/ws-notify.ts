/**
 * Server-side signals to the WebSocket server (spec 11).
 */

import type { WsRoom } from './shared/ws-messages';

/** A room whose viewers must refetch. */
export type RoomNotification = WsRoom;

const NOTIFY_TIMEOUT_MS = 1000;

/**
 * Signal rooms after a change. A signal is only a hint to refetch, so a failure is
 * logged and never fails the mutation it follows.
 *
 * @param notifications - The rooms to signal.
 */
export async function notifyRooms(notifications: RoomNotification[]): Promise<void> {
  const secret = process.env.WS_SHARED_SECRET;
  if (notifications.length === 0 || !secret) return;

  const baseUrl = process.env.WS_INTERNAL_URL || 'http://ws-server:8888';
  try {
    const response = await fetch(`${baseUrl}/internal/notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ws-secret': secret },
      body: JSON.stringify(notifications),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('[ws-notify] rejected with status', response.status);
    }
  } catch (error) {
    console.error('[ws-notify] failed:', error);
  }
}
