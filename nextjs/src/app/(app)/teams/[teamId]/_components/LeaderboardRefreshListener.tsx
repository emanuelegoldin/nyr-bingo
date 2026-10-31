"use client";

import { useTeamWs } from "@/components/team-ws-provider";
import type { WsIncomingMessage } from "@/lib/shared/ws-messages";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Re-renders the team page from the server when a card change is signalled, so
 * the leaderboard shows the persisted values without a reload.
 * Spec Reference: 11-real-time-card-updates.md, 12-team-tabs.md
 *
 * Must be rendered inside `TeamWsProvider` and above the tabs, because inactive
 * tabs are unmounted.
 *
 * @returns Nothing; this component only subscribes to WebSocket messages.
 */
export function LeaderboardRefreshListener() {
  const router = useRouter();
  const { addMessageListener } = useTeamWs();

  useEffect(() => {
    return addMessageListener((msg: WsIncomingMessage) => {
      if (msg.type === "refresh-card") {
        router.refresh();
      }
    });
  }, [addMessageListener, router]);

  return null;
}
