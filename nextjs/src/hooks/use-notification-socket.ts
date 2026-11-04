"use client";

import { apiFetch } from "@/lib/api-client";
import { getWsUrl } from "@/lib/shared/ws-messages";
import { onTabReturn, openReconnectingSocket, sendJoinRoom, type ReconnectingSocket } from "@/lib/ws-client";
import { useEffect, useRef } from "react";

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
    let socket: ReconnectingSocket | null = null;

    const start = async () => {
      // Without a user there is no room to join
      const result = await apiFetch<{ user?: { id: string } }>("/api/profile");
      if (disposed || !result.ok || !result.data.user) return;
      const userId = result.data.user.id;
      socket = openReconnectingSocket({
        url: wsUrl,
        onOpen: (ws) => void sendJoinRoom(ws, { type: "user", id: userId }),
        onMessage: (message) => {
          if (message.type === "refresh-notifications") onRefreshRef.current();
        },
        onReconnect: () => onRefreshRef.current(),
      });
    };
    void start();

    const stopWatchingTab = onTabReturn(() => onRefreshRef.current());

    return () => {
      disposed = true;
      socket?.close();
      stopWatchingTab();
    };
  }, []);
}
