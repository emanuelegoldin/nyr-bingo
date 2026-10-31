"use client";

import type { WsIncomingMessage } from "@/components/team-ws-provider";
import { useTeamWs } from "@/components/team-ws-provider";
import { useEffect, useRef } from "react";

/**
 * Joins the WebSocket room of a resolution and calls `onRefresh` whenever the
 * server relays a `refresh-resolution` message for that resolution (spec 11).
 *
 * The socket stays in the room until it closes: only the listener is removed
 * when the effect is cleaned up, and no leave message is sent. Outside a
 * `TeamWsProvider` the WebSocket functions are no-ops, so this does nothing.
 *
 * The latest `onRefresh` is kept in a ref, so a handler that changes on every
 * render does not re-join the room or re-register the listener.
 *
 * @param resolutionId - Id of the resolution whose room is joined.
 * @param onRefresh - Called when the resolution should be re-fetched.
 * @param enabled - When false nothing is joined or listened to. Defaults to true.
 */
export const useResolutionRoom = (
  resolutionId: string,
  onRefresh: () => void,
  enabled = true,
): void => {
  const { sendWsMessage, addMessageListener } = useTeamWs();
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled) return;

    sendWsMessage({
      type: "join-resolution-room",
      body: { resolutionId },
    });

    const unsubscribe = addMessageListener((msg: WsIncomingMessage) => {
      if (msg.type === "refresh-resolution" && msg.resolutionId === resolutionId) {
        onRefreshRef.current();
      }
    });

    return unsubscribe;
  }, [enabled, resolutionId, sendWsMessage, addMessageListener]);
};
