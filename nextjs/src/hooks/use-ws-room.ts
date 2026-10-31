"use client";

import { useTeamWs } from "@/components/team-ws-provider";
import type { WsListenerMessage, WsRoom } from "@/lib/shared/ws-messages";
import { useEffect, useRef } from "react";

/**
 * Whether a message tells the viewers of a room to refetch.
 *
 * @param msg - The incoming message.
 * @param room - The room being watched.
 * @returns True if the message is for that room.
 */
function isRoomRefresh(msg: WsListenerMessage, room: WsRoom): boolean {
  if (msg.type === "catch-up") return true;
  if (room.type === "card") return msg.type === "refresh-card";
  if (room.type === "thread") return msg.type === "refresh-thread" && msg.threadId === room.id;
  return msg.type === "refresh-resolution" && msg.resolutionId === room.id;
}

/**
 * Joins a WebSocket room and calls `onRefresh` when the server signals it (spec 11).
 * Outside a `TeamWsProvider` this does nothing.
 *
 * The latest `onRefresh` is kept in a ref, so a handler that changes on every
 * render does not re-join the room or re-register the listener.
 *
 * @param room - The room to join, or null when there is none yet.
 * @param onRefresh - Called when the room's data should be re-fetched.
 * @param enabled - When false nothing is joined or listened to. Defaults to true.
 */
export const useWsRoom = (
  room: WsRoom | null,
  onRefresh: () => void,
  enabled = true,
): void => {
  const { joinRoom, addMessageListener } = useTeamWs();
  const onRefreshRef = useRef(onRefresh);
  const type = room?.type;
  const id = room?.id;

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    if (!enabled || !type || !id) return;

    const target: WsRoom = { type, id };
    const leaveRoom = joinRoom(target);
    const unsubscribe = addMessageListener((msg: WsListenerMessage) => {
      if (isRoomRefresh(msg, target)) {
        onRefreshRef.current();
      }
    });

    return () => {
      leaveRoom();
      unsubscribe();
    };
  }, [enabled, type, id, joinRoom, addMessageListener]);
};
