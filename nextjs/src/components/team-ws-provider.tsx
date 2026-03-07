"use client";

/**
 * TeamWsProvider
 *
 * Manages a **single** WebSocket connection per team, shared by every
 * component that needs real-time card updates (BingoCard, ResolutionCell,
 * dialogs, etc.).
 *
 * Usage:
 *   <TeamWsProvider teamId={teamId} onRefresh={reloadCards}>
 *     <BingoCard ... />
 *     <BingoCard ... />
 *   </TeamWsProvider>
 *
 * Child components call `broadcastCardRefresh()` (via `useTeamWs()`) after
 * persisting a mutation. The provider sends one `card-refresh` WS message
 * which the server will broadcast to every *other* client in the same room.
 * Incoming messages from the server invoke the `onRefresh` callback once,
 * no matter how many cards are rendered.
 *
 * Components that need resolution-level real-time updates (e.g.
 * the detail dialog showing compound subtasks or iterative counters)
 * can use `sendWsMessage()` and `addMessageListener()` to join
 * resolution rooms and react to `refresh-resolution` events.
 */

import { createContext, useCallback, useContext, useEffect, useRef } from "react";

// ── WS URL helper ─────────────────────────────────────────────────

function getWsUrl(): string | null {
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }
  return null;
}

// ── Types for parsed incoming WS messages ─────────────────────────

/** Shape of a parsed WS message received from the server. */
export interface WsIncomingMessage {
  type: string;
  [key: string]: unknown;
}

/** Callback signature for message listeners. */
export type WsMessageHandler = (msg: WsIncomingMessage) => void;

// ── Context ───────────────────────────────────────────────────────

interface TeamWsContextValue {
  /** Send a card-refresh message so other viewers re-fetch. */
  broadcastCardRefresh: () => void;
  /** Send an arbitrary JSON message over the shared WebSocket. */
  sendWsMessage: (msg: object) => void;
  /**
   * Register a listener for incoming WS messages.
   * Returns an unsubscribe function.
   */
  addMessageListener: (handler: WsMessageHandler) => () => void;
}

const TeamWsContext = createContext<TeamWsContextValue>({
  broadcastCardRefresh: () => {},
  sendWsMessage: () => {},
  addMessageListener: () => () => {},
});

/** Hook for child components to interact with the team WebSocket. */
export function useTeamWs(): TeamWsContextValue {
  return useContext(TeamWsContext);
}

// ── Provider ──────────────────────────────────────────────────────

interface TeamWsProviderProps {
  /** The team whose card-room we join. */
  teamId: string;
  /** Called when the server pushes a refresh event (another client changed something). */
  onRefresh?: () => void;
  children: React.ReactNode;
}

export function TeamWsProvider({ teamId, onRefresh, children }: TeamWsProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);

  // Stable ref so we don't re-open the socket when onRefresh identity changes.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Registered message listeners (for resolution-level updates, etc.)
  const listenersRef = useRef<Set<WsMessageHandler>>(new Set());

  // ── Open a single WS for the lifetime of this provider ────────
  useEffect(() => {
    if (!teamId) return;
    const wsUrl = getWsUrl();
    if (!wsUrl) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: "join-card-room",
          body: { teamId },
        })
      );
    };

    ws.onmessage = (event) => {
      // Parse the incoming message
      let parsed: WsIncomingMessage | null = null;
      try {
        parsed = JSON.parse(event.data as string) as WsIncomingMessage;
      } catch {
        /* ignore malformed messages */
      }

      // Card-level refresh: invoke the onRefresh callback
      // (backward compatible — fires for any card-level event)
      if (!parsed || parsed.type === "refresh-card" || parsed.type === "refresh-thread") {
        onRefreshRef.current?.();
      }

      // Dispatch to all registered listeners (resolution-level, etc.)
      if (parsed) {
        for (const handler of listenersRef.current) {
          try {
            handler(parsed);
          } catch (err) {
            console.error("[TeamWsProvider] listener error:", err);
          }
        }
      }
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
  }, [teamId]);

  // ── Send an arbitrary message over the shared WebSocket ───────
  const sendWsMessage = useCallback((msg: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }, []);

  // ── Broadcast helper (stable identity) ────────────────────────
  const broadcastCardRefresh = useCallback(() => {
    if (!teamId) return;
    sendWsMessage({ type: "card-refresh", body: { teamId } });
  }, [teamId, sendWsMessage]);

  // ── Listener subscribe/unsubscribe (stable identity) ──────────
  const addMessageListener = useCallback((handler: WsMessageHandler): (() => void) => {
    listenersRef.current.add(handler);
    return () => {
      listenersRef.current.delete(handler);
    };
  }, []);

  return (
    <TeamWsContext.Provider value={{ broadcastCardRefresh, sendWsMessage, addMessageListener }}>
      {children}
    </TeamWsContext.Provider>
  );
}
