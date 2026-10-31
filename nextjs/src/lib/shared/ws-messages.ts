/**
 * Client side of the WebSocket protocol (spec 11).
 * ws-server builds from its own Docker context, so it keeps its own definitions
 * in ws-server/messages/; message strings must stay in sync with them.
 */

/** Messages a client sends to the server. */
export type WsOutgoingMessage =
  | { type: 'join-thread'; body: { threadId: string } }
  | { type: 'join-card-room'; body: { teamId: string } }
  | { type: 'join-resolution-room'; body: { resolutionId: string } };

/** Messages the server sends to clients. */
export type WsIncomingMessage =
  | { type: 'refresh-thread' }
  | { type: 'refresh-card' }
  | { type: 'refresh-resolution'; resolutionId: string };

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
