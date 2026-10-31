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
 * Components that need resolution-level real-time updates (e.g.
 * the detail dialog showing compound subtasks or iterative counters)
 * can use `sendWsMessage()` and `addMessageListener()` to join
 * resolution rooms and react to `refresh-resolution` events.
 */

import { getWsUrl, type WsIncomingMessage, type WsOutgoingMessage } from "@/lib/shared/ws-messages";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";

/** Callback signature for message listeners. */
export type WsMessageHandler = (msg: WsIncomingMessage) => void;

// ── Context ───────────────────────────────────────────────────────

interface TeamWsContextValue {
  /** Send an arbitrary JSON message over the shared WebSocket. */
  sendWsMessage: (msg: WsOutgoingMessage) => void;
  /**
   * Register a listener for incoming WS messages.
   * Returns an unsubscribe function.
   */
  addMessageListener: (handler: WsMessageHandler) => () => void;
  /** The team name (used by card components) */
  teamName: string;
}

const TeamWsContext = createContext<TeamWsContextValue>({
  sendWsMessage: () => { },
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
  /** Messages queued while the socket is still CONNECTING. */
  const pendingMessagesRef = useRef<WsOutgoingMessage[]>([]);

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

  // ── Open a single WS for the lifetime of this provider ────────
  useEffect(() => {
    if (!teamId) return;
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      const joinMessage: WsOutgoingMessage = { type: "join-card-room", body: { teamId } };
      ws.send(JSON.stringify(joinMessage));

      // Flush any messages that were queued while CONNECTING
      for (const msg of pendingMessagesRef.current) {
        ws.send(JSON.stringify(msg));
      }
      pendingMessagesRef.current = [];
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
      pendingMessagesRef.current = [];
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [teamId, dispatchToListeners]);

  // ── Send an arbitrary message over the shared WebSocket ───────
  const sendWsMessage = useCallback((msg: WsOutgoingMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else if (ws && ws.readyState === WebSocket.CONNECTING) {
      pendingMessagesRef.current.push(msg);
    }
  }, []);

  // ── Listener subscribe/unsubscribe (stable identity) ──────────
  const addMessageListener = useCallback((handler: WsMessageHandler): (() => void) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  return (
    <TeamWsContext.Provider value={{ sendWsMessage, addMessageListener, teamName }}>
      {children}
    </TeamWsContext.Provider>
  );
}
