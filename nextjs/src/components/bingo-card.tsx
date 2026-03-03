"use client";

/**
 * Bingo Card Component
 * Spec Reference: 05-bingo-card-generation.md, 06-bingo-gameplay.md, 11-real-time-card-updates.md
 *
 * Real-time behaviour
 * -------------------
 * The WebSocket connection is managed by `TeamWsProvider` at the page
 * level — one connection per team, shared by every card rendered on
 * the page.  This component consumes the `useTeamWs()` context to
 * broadcast `card-refresh` messages after cell-level mutations.
 *
 * Child components (e.g. ResolutionCell, CellThreadDialog) use the
 * re-exported `useCardWsBroadcast` hook which delegates to the same
 * team-level WebSocket.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Button } from "./ui/button";
import { CellSourceType, CellState, ProofStatus, ResolutionType } from "@/lib/shared/types";
import { hasBingo } from "@/lib/shared/bingo-utils";
import { JokerCell } from "./cell/joker";
import { ResolutionCell } from "./cell/resolution-cell";
import { Confetti } from "./confetti";
import { useTeamWs } from "./team-ws-provider";

// ── Context for child components to broadcast card-refresh ────────

/**
 * `CardWsContext` exposes a function that child components can call
 * after they persist a cell-level mutation.  Delegates to the
 * team-level `TeamWsProvider`.
 */
export const CardWsContext = createContext<{
  broadcastCardRefresh: () => void;
}>({
  broadcastCardRefresh: () => {},
});

/** Convenience hook for child components. */
export function useCardWsBroadcast() {
  return useContext(CardWsContext);
}

// ── Types ─────────────────────────────────────────────────────────

interface BingoCell {
  id: string;
  cardId: string;
  position: number;
  resolutionId: string | null;
  resolutionType: ResolutionType;
  resolutionText: string;
  resolutionTitle: string;
  isJoker: boolean;
  isEmpty: boolean;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  state: CellState;
  reviewThreadId?: string | null;
  proof: {
    id: string;
    status: ProofStatus;
  } | null;
}

interface BingoCardProps {
  cells: BingoCell[];
  isOwner?: boolean;
  teamId?: string;
  currentUserId?: string;
  onCellUpdate?: (cellId: string, newState: 'pending' | 'completed') => void;
  onRefresh?: () => void;
}

// ── Component ─────────────────────────────────────────────────────

export function BingoCard({ cells, isOwner = false, teamId, currentUserId, onCellUpdate, onRefresh }: BingoCardProps) {
  // Sort cells by position
  const sortedCells = [...cells].sort((a, b) => a.position - b.position);
  const [editMode, setEditMode] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // ── Use team-level WebSocket from TeamWsProvider ──────────────
  const { broadcastCardRefresh } = useTeamWs();

  // ── Confetti: detect when a bingo line is newly completed ─────
  // Keep a snapshot of the previous cells so we can compare.
  const prevCellsRef = useRef<BingoCell[] | null>(null);

  useEffect(() => {
    const prev = prevCellsRef.current;
    // Always update the snapshot for the next comparison
    prevCellsRef.current = sortedCells;

    // Skip initial render (no previous state to compare against)
    if (!prev) return;

    const hadBingo = hasBingo(prev);
    const nowHasBingo = hasBingo(sortedCells);

    // Only fire confetti on the transition false → true
    if (hadBingo || !nowHasBingo) return;

    // Check whether the *only* state change was completed → pending_review.
    // If so, suppress confetti — a proof request isn't a celebration moment.
    const prevByPos = new Map(prev.map((c) => [c.position, c]));
    const hasNonReviewTransition = sortedCells.some((cell) => {
      const old = prevByPos.get(cell.position);
      if (!old) return false;
      if (old.state === cell.state) return false;
      // A cell changed state — is it something other than completed→pending_review?
      return !(old.state === CellState.COMPLETED && cell.state === CellState.PENDING_REVIEW);
    });

    if (hasNonReviewTransition) {
      setShowConfetti(true);
    }
  }, [sortedCells]);

  // ── Wrapped callbacks ─────────────────────────────────────────
  // Child components call these instead of the raw props.
  // After the (potentially-async) parent callback completes we
  // broadcast a card-refresh so other team members re-fetch.
  // This guarantees the DB mutation has landed before the
  // broadcast goes out — avoiding stale reads on other clients.

  const wrappedOnCellUpdate = useCallback(
    async (cellId: string, newState: 'pending' | 'completed') => {
      // onCellUpdate may be an async function (the parent's
      // handleCellUpdate). Await it so the API call finishes
      // before we broadcast.
      await Promise.resolve(onCellUpdate?.(cellId, newState));
      broadcastCardRefresh();
    },
    [onCellUpdate, broadcastCardRefresh],
  );

  const wrappedOnRefresh = useCallback(
    async () => {
      await Promise.resolve(onRefresh?.());
      broadcastCardRefresh();
    },
    [onRefresh, broadcastCardRefresh],
  );

  useEffect(() => {
    // Safety: cannot stay in edit mode when not the owner
    if (!isOwner) setEditMode(false);
  }, [isOwner]);

  return (
    <CardWsContext.Provider value={{ broadcastCardRefresh }}>
      {/* Confetti overlay — self-destructs after the animation */}
      {showConfetti && <Confetti />}

      <div className="space-y-3">
        {isOwner && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {editMode ? 'Edit mode: select a cell to replace it.' : ''}
            </p>
            <Button
              variant={editMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEditMode((v) => !v)}
            >
              {editMode ? 'Done' : 'Edit Card'}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-5 grid-rows-5 gap-2 md:gap-4">
          {sortedCells.map((cell) => (
            cell.isJoker ?
            <JokerCell key={cell.id} />
            :
            <ResolutionCell
                key={cell.id}
                cell={cell}
                isOwner={isOwner}
                editMode={editMode}
                teamId={teamId ? teamId : ""}
                currentUserId={currentUserId ? currentUserId : ""}
                existingCells={sortedCells}
                onUpdate={onCellUpdate ? wrappedOnCellUpdate : undefined}
                onRefresh={wrappedOnRefresh}/>
          ))}
        </div>
      </div>
    </CardWsContext.Provider>
  );
}
