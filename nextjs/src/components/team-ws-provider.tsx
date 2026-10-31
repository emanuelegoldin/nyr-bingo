"use client";

/**
 * TeamWsProvider
 *
 * Manages a **single** WebSocket connection per team, shared by every
 * component that needs real-time card updates (BingoCard, ResolutionCell,
 * dialogs, etc.).
 *
 * Usage:
 *   <TeamWsProvider teamId={teamId} teamName={teamName}>
 *     <BingoCard ... />
 *     <BingoCard ... />
 *   </TeamWsProvider>
 *
 * The Next.js server signals rooms after each mutation; clients only listen.
 * Incoming messages are dispatched to the listeners registered with
 * `addMessageListener()`.
 *
 * Components that watch a thread or a resolution use `useWsRoom()`, which joins
 * the room on this socket and reacts to its refresh events.
 */

import { apiFetch } from "@/lib/api-client";
import { getWsUrl, type WsIncomingMessage, type WsOutgoingMessage, type WsRoom } from "@/lib/shared/ws-messages";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";

/** Callback signature for message listeners. */
export type WsMessageHandler = (msg: WsIncomingMessage) => void;

// ── Context ───────────────────────────────────────────────────────

interface TeamWsContextValue {
  /** Join a room on the shared WebSocket. Returns a function that stops tracking it. */
  joinRoom: (room: WsRoom) => () => void;
  /**
   * Register a listener for incoming WS messages.
   * Returns an unsubscribe function.
   */
  addMessageListener: (handler: WsMessageHandler) => () => void;
  /** The team name (used by card components) */
  teamName: string;
}

const TeamWsContext = createContext<TeamWsContextValue>({
  joinRoom: () => () => { },
  addMessageListener: () => () => { },
  teamName: ""
});

/** Hook for child components to interact with the team WebSocket. */
export function useTeamWs(): TeamWsContextValue {
  return useContext(TeamWsContext);
}

// ── Provider ──────────────────────────────────────────────────────

interface TeamWsProviderProps {
  /** The team whose card-room we join. */
  teamId: string;
  /** The team name (used by card components) */
  teamName: string;
  children: React.ReactNode;
}

export function TeamWsProvider({ teamId, teamName, children }: TeamWsProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
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
  const dispatchToListeners = useCallback((msg: WsIncomingMessage) => {
    for (const handler of listenersRef.current) {
      try {
        handler(msg);
      } catch (err) {
        console.error("[TeamWsProvider] listener error:", err);
      }
    }
  }, []);

  /**
   * Ask the API for a room token and join with it. A refused token is ignored: the
   * viewer simply gets no live updates for that room.
   *
   * @param room - The room to join.
   * @param ws - The socket to join on.
   */
  const sendJoin = useCallback(async (room: WsRoom, ws: WebSocket) => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const query = new URLSearchParams({ type: room.type, id: room.id });
    const result = await apiFetch<{ token: string }>(`/api/ws-token?${query}`);
    if (result.ok && ws.readyState === WebSocket.OPEN) {
      const joinMessage: WsOutgoingMessage = { type: "join-room", token: result.data.token };
      ws.send(JSON.stringify(joinMessage));
    }
  }, []);

  // ── Open a single WS for the lifetime of this provider ────────
  useEffect(() => {
    if (!teamId) return;
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      sendJoin({ type: "card", id: teamId }, ws);
      for (const room of roomsRef.current) {
        sendJoin(room, ws);
      }
    };

    ws.onmessage = (event) => {
      // Parse the incoming message
      let parsed: WsIncomingMessage;
      try {
        parsed = JSON.parse(event.data as string) as WsIncomingMessage;
      } catch {
        return; /* ignore malformed messages */
      }

      // Dispatch to all registered listeners (resolution-level, etc.)
      dispatchToListeners(parsed);
    };

    ws.onerror = (e) => {
      console.error("[TeamWsProvider] WebSocket error:", e);
    };

    return () => {
      if (wsRef.current === ws) wsRef.current = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [teamId, dispatchToListeners, sendJoin]);

  // ── Join a room (stable identity) ─────────────────────────────
  const joinRoom = useCallback((room: WsRoom): (() => void) => {
    roomsRef.current.add(room);
    if (wsRef.current) sendJoin(room, wsRef.current);
    return () => {
      roomsRef.current.delete(room);
    };
  }, [sendJoin]);

  // ── Listener subscribe/unsubscribe (stable identity) ──────────
  const addMessageListener = useCallback((handler: WsMessageHandler): (() => void) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  return (
    <TeamWsContext.Provider value={{ joinRoom, addMessageListener, teamName }}>
      {children}
    </TeamWsContext.Provider>
  );
}
