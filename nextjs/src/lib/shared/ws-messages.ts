/**
 * Client side of the WebSocket protocol (spec 11).
 * ws-server builds from its own Docker context, so it keeps its own definitions
 * in ws-server/messages/; message strings must stay in sync with them.
 */

/** A room viewers can join: a team's cards, a review thread, a resolution or a user's notifications. */
export interface WsRoom {
  type: 'card' | 'thread' | 'resolution' | 'user';
  /** The team, thread, resolution or user id. */
  id: string;
}

/** Messages a client sends to the server. */
export type WsOutgoingMessage = { type: 'join-room'; token: string };

/** Messages the server sends to clients. */
export type WsIncomingMessage =
  | { type: 'refresh-thread'; threadId: string }
  | { type: 'refresh-card' }
  | { type: 'refresh-resolution'; resolutionId: string }
  | { type: 'refresh-notifications' };

/**
 * What the provider hands its listeners: server messages, plus `catch-up` when signals
 * may have been missed, so every surface should refetch.
 */
export type WsListenerMessage = WsIncomingMessage | { type: 'catch-up' };

/**
 * Builds the URL of the WebSocket endpoint for the current page.
 *
 * @returns The WebSocket URL, or null when not running in a browser.
 */
export function getWsUrl(): string | null {
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws`;
  }
  return null;
}
