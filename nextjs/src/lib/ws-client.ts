/**
 * Browser WebSocket client shared by the team socket and the notification socket:
 * reconnection with backoff, room joining and catch-up when the tab comes back.
 * Spec Reference: 11-real-time-card-updates.md, 19-notifications.md
 */

import { apiFetch } from "@/lib/api-client";
import type { WsIncomingMessage, WsOutgoingMessage, WsRoom } from "@/lib/shared/ws-messages";

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30 * 1000;
const CATCH_UP_MIN_INTERVAL_MS = 30 * 1000;

/**
 * Ask the API for a room token and join with it. A refused token is ignored: the
 * viewer simply gets no live updates for that room.
 *
 * @param ws - The socket to join on.
 * @param room - The room to join.
 */
export async function sendJoinRoom(ws: WebSocket, room: WsRoom): Promise<void> {
  if (ws.readyState !== WebSocket.OPEN) return;
  const query = new URLSearchParams({ type: room.type, id: room.id });
  const result = await apiFetch<{ token: string }>(`/api/ws-token?${query}`);
  if (result.ok && ws.readyState === WebSocket.OPEN) {
    const joinMessage: WsOutgoingMessage = { type: "join-room", token: result.data.token };
    ws.send(JSON.stringify(joinMessage));
  }
}

/** Callbacks of {@link openReconnectingSocket}. */
export interface ReconnectingSocketOptions {
  /** The WebSocket server URL. */
  url: string;
  /** Called each time the socket opens, to join its rooms. */
  onOpen: (ws: WebSocket) => void;
  /** Called with every well-formed incoming message. */
  onMessage: (message: WsIncomingMessage) => void;
  /** Called when the socket reopens: anything that happened while disconnected was missed. */
  onReconnect: () => void;
}

/** Handle on a socket opened by {@link openReconnectingSocket}. */
export interface ReconnectingSocket {
  /** The open socket, or null while disconnected. */
  getSocket: () => WebSocket | null;
  /** Close the socket and stop reconnecting. */
  close: () => void;
}

/**
 * Open a WebSocket that reconnects with exponential backoff until closed.
 *
 * @param options - The URL and the open, message and reconnect callbacks.
 * @returns The handle to read the current socket and to close it.
 */
export function openReconnectingSocket({
  url,
  onOpen,
  onMessage,
  onReconnect,
}: ReconnectingSocketOptions): ReconnectingSocket {
  let socket: WebSocket | null = null;
  let disposed = false;
  let failedAttempts = 0;
  let hasConnected = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const connect = () => {
    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      failedAttempts = 0;
      onOpen(ws);
      if (hasConnected) onReconnect();
      hasConnected = true;
    };

    ws.onmessage = (event) => {
      let parsed: WsIncomingMessage;
      try {
        parsed = JSON.parse(event.data as string) as WsIncomingMessage;
      } catch {
        return; /* ignore malformed messages */
      }
      onMessage(parsed);
    };

    ws.onerror = (e) => {
      console.error("[ws-client] WebSocket error:", e);
    };

    ws.onclose = () => {
      if (socket === ws) socket = null;
      if (disposed) return;
      const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** failedAttempts, RECONNECT_MAX_DELAY_MS);
      failedAttempts += 1;
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  connect();

  return {
    getSocket: () => socket,
    close: () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
    },
  };
}

/**
 * Call back when the tab becomes visible or focused again, at most once every 30 seconds,
 * so data missed while it was in the background is reloaded.
 *
 * @param onReturn - Called when the tab comes back.
 * @returns A function that removes the listeners.
 */
export function onTabReturn(onReturn: () => void): () => void {
  let lastCatchUp = Date.now();
  const catchUp = () => {
    const now = Date.now();
    if (document.visibilityState !== "visible" || now - lastCatchUp < CATCH_UP_MIN_INTERVAL_MS) return;
    lastCatchUp = now;
    onReturn();
  };

  window.addEventListener("focus", catchUp);
  document.addEventListener("visibilitychange", catchUp);
  return () => {
    window.removeEventListener("focus", catchUp);
    document.removeEventListener("visibilitychange", catchUp);
  };
}
