"use client";

import { apiFetch } from "@/lib/api-client";
import { getWsUrl, type WsIncomingMessage, type WsOutgoingMessage } from "@/lib/shared/ws-messages";
import { useEffect, useRef } from "react";

const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30 * 1000;
const CATCH_UP_MIN_INTERVAL_MS = 30 * 1000;

/**
 * Join the signed-in user's room on a socket of its own, and call `onRefresh` when notifications
 * may have changed: on a signal, after a reconnect, and when the tab comes back (specs 11 and 19).
 * `TeamWsProvider` cannot host this: it needs a team, and only exists on team pages.
 *
 * @param onRefresh - Called when the notifications should be refetched.
 */
export function useNotificationSocket(onRefresh: () => void): void {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    let disposed = false;
    let socket: WebSocket | null = null;
    let failedAttempts = 0;
    let hasConnected = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const join = async (ws: WebSocket, userId: string) => {
      const query = new URLSearchParams({ type: "user", id: userId });
      const result = await apiFetch<{ token: string }>(`/api/ws-token?${query}`);
      if (result.ok && ws.readyState === WebSocket.OPEN) {
        const message: WsOutgoingMessage = { type: "join-room", token: result.data.token };
        ws.send(JSON.stringify(message));
      }
    };

    const connect = (userId: string) => {
      const ws = new WebSocket(wsUrl);
      socket = ws;

      ws.onopen = () => {
        failedAttempts = 0;
        void join(ws, userId);
        // Anything that happened while disconnected was missed
        if (hasConnected) onRefreshRef.current();
        hasConnected = true;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as WsIncomingMessage;
          if (message.type === "refresh-notifications") onRefreshRef.current();
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** failedAttempts, RECONNECT_MAX_DELAY_MS);
        failedAttempts += 1;
        reconnectTimer = setTimeout(() => connect(userId), delay);
      };
    };

    const start = async () => {
      // Without a user there is no room to join
      const result = await apiFetch<{ user?: { id: string } }>("/api/profile");
      if (!disposed && result.ok && result.data.user) connect(result.data.user.id);
    };
    void start();

    let lastCatchUp = Date.now();
    const catchUp = () => {
      const now = Date.now();
      if (document.visibilityState !== "visible" || now - lastCatchUp < CATCH_UP_MIN_INTERVAL_MS) return;
      lastCatchUp = now;
      onRefreshRef.current();
    };
    window.addEventListener("focus", catchUp);
    document.addEventListener("visibilitychange", catchUp);

    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      socket?.close();
      window.removeEventListener("focus", catchUp);
      document.removeEventListener("visibilitychange", catchUp);
    };
  }, []);
}
