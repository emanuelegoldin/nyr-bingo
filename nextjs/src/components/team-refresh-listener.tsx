"use client";

import { useTeamWs } from "@/components/team-ws-provider";
import type { WsListenerMessage } from "@/lib/shared/ws-messages";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** A burst of signals (for example one per linked cell) causes a single refresh. */
const REFRESH_DEBOUNCE_MS = 500;

/**
 * Re-renders the page from the server when a team change is signalled, so everything
 * built from server props updates without a reload.
 * Spec Reference: 11-real-time-card-updates.md, 12-team-tabs.md
 *
 * Must be rendered inside `TeamWsProvider`, and on the game page above the tabs,
 * because inactive tabs are unmounted.
 *
 * @returns Nothing; this component only subscribes to WebSocket messages.
 */
export function TeamRefreshListener() {
  const router = useRouter();
  const { addMessageListener } = useTeamWs();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = addMessageListener((msg: WsListenerMessage) => {
      if (msg.type !== "refresh-card" && msg.type !== "catch-up") return;
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [addMessageListener, router]);

  return null;
}
