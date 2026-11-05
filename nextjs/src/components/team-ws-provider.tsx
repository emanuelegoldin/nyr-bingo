"use client";

/**
 * TeamWsProvider
 *
 * Manages a **single** WebSocket connection per team, reconnecting when it drops, shared by every
 * component that needs real-time card updates (BingoCard, ResolutionCell,
 * dialogs, etc.).
 *
 * Usage:
 *   <TeamWsProvider teamId={teamId}>
 *     <BingoCard ... />
 *     <BingoCard ... />
 *   </TeamWsProvider>
 *
 * The Next.js server signals rooms after each mutation; clients only listen.
 * Incoming messages are dispatched to the listeners registered with
 * `addMessageListener()`.
 *
 * Components that watch a thread or a team's cards use `useWsRoom()`, which joins
 * the room on this socket and reacts to its refresh events.
 */

import { getWsUrl, type WsListenerMessage, type WsRoom } from "@/lib/shared/ws-messages";
import { onTabReturn, openReconnectingSocket, sendJoinRoom, type ReconnectingSocket } from "@/lib/ws-client";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";

/** Callback signature for message listeners. */
export type WsMessageHandler = (msg: WsListenerMessage) => void;

// ── Context ───────────────────────────────────────────────────────

interface TeamWsContextValue {
  /** The team whose card room the provider joins, or null outside a provider. */
  teamId: string | null;
  /** Join a room on the shared WebSocket. Returns a function that stops tracking it. */
  joinRoom: (room: WsRoom) => () => void;
  /**
   * Register a listener for incoming WS messages.
   * Returns an unsubscribe function.
   */
  addMessageListener: (handler: WsMessageHandler) => () => void;
}

const TeamWsContext = createContext<TeamWsContextValue>({
  teamId: null,
  joinRoom: () => () => { },
  addMessageListener: () => () => { },
});

/** Hook for child components to interact with the team WebSocket. */
export function useTeamWs(): TeamWsContextValue {
  return useContext(TeamWsContext);
}

// ── Provider ──────────────────────────────────────────────────────

interface TeamWsProviderProps {
  /** The team whose card-room we join. */
  teamId: string;
  children: React.ReactNode;
}

export function TeamWsProvider({ teamId, children }: TeamWsProviderProps) {
  /** Rooms joined by descendants, joined again whenever the socket opens. */
  const roomsRef = useRef<Set<WsRoom>>(new Set());

  // Registered message listeners (for resolution-level updates, etc.)
  const listenersRef = useRef<Set<WsMessageHandler>>(new Set());

  /**
   * Dispatch a message to every registered listener. A failing listener does
   * not stop the others.
   *
   * @param msg - The message to deliver.
   */
  const dispatchToListeners = useCallback((msg: WsListenerMessage) => {
    for (const handler of listenersRef.current) {
      try {
        handler(msg);
      } catch (err) {
        console.error("[TeamWsProvider] listener error:", err);
      }
    }
  }, []);

  /** The team's reconnecting socket, or null when none is running. */
  const socketRef = useRef<ReconnectingSocket | null>(null);

  // ── Keep one WS open for the lifetime of this provider ───────
  useEffect(() => {
    if (!teamId) return;
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    const socket = openReconnectingSocket({
      url: wsUrl,
      onOpen: (ws) => {
        void sendJoinRoom(ws, { type: "card", id: teamId });
        for (const room of roomsRef.current) {
          void sendJoinRoom(ws, room);
        }
      },
      onMessage: dispatchToListeners,
      onReconnect: () => dispatchToListeners({ type: "catch-up" }),
    });
    socketRef.current = socket;

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [teamId, dispatchToListeners]);

  // ── Catch up when the tab comes back ──────────────────────────
  useEffect(() => onTabReturn(() => dispatchToListeners({ type: "catch-up" })), [dispatchToListeners]);

  // ── Join a room (stable identity) ─────────────────────────────
  const joinRoom = useCallback((room: WsRoom): (() => void) => {
    roomsRef.current.add(room);
    const ws = socketRef.current?.getSocket();
    if (ws) void sendJoinRoom(ws, room);
    return () => {
      roomsRef.current.delete(room);
    };
  }, []);

  // ── Listener subscribe/unsubscribe (stable identity) ──────────
  const addMessageListener = useCallback((handler: WsMessageHandler): (() => void) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  return (
    <TeamWsContext.Provider value={{ teamId, joinRoom, addMessageListener }}>
      {children}
    </TeamWsContext.Provider>
  );
}
