/**
 * Resolution Detail Dialog
 * Displays a detailed view for any resolution type on the bingo card.
 *
 * Layout:
 * - Title + state badge in the header
 * - Description (readonly)
 * - Type-specific content:
 *     - Base / Team: simple text display
 *     - Compound: checklist with toggle support (owner only)
 *     - Iterative: counter with +/- buttons and progress bar (owner only)
 * - Action button at the bottom based on cell state and ownership
 *
 * Spec Reference: Resolution Rework — bingo card detail view
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { CellDialog } from "./cell-dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Progress } from "../ui/progress";
import { DialogFooter } from "../ui/dialog";
import { Check, Minus, Plus, Loader2, Undo2, Eye, MessageSquare, Hourglass, ThumbsUp, X } from "lucide-react";
import { CellState, ResolutionType, ProofStatus } from "@/lib/shared/types";
import type { Subtask } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { useTeamWs } from "../team-ws-provider";
import type { WsIncomingMessage } from "../team-ws-provider";

/* ─── Data types ─────────────────────────────────────────────────── */

interface BaseData {
  type: ResolutionType.BASE;
  id: string;
  title: string;
  description?: string | null;
}

interface CompoundData {
  type: ResolutionType.COMPOUND;
  id: string;
  title: string;
  description?: string | null;
  subtasks: Subtask[];
}

interface IterativeData {
  type: ResolutionType.ITERATIVE;
  id: string;
  title: string;
  description?: string | null;
  numberOfRepetition: number;
  completedTimes: number;
}

export type ResolutionDetailData = BaseData | CompoundData | IterativeData;

/* ─── Cell context passed from the bingo card ────────────────────── */

export interface CellContext {
  cellId: string;
  state: CellState;
  proofStatus?: ProofStatus | null;
  reviewThreadId?: string | null;
}

/* ─── Props ──────────────────────────────────────────────────────── */

interface ResolutionDetailDialogProps {
  data: ResolutionDetailData;
  cell: CellContext;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isOwner: boolean;
  /** Human-readable source label, e.g. "Personal", "Team Goal", or a username */
  sourceLabel?: string;
  /** Called after a mutation so the parent can refresh the bingo card */
  onRefresh?: () => void;
  /** Called when the owner wants to mark a base/team cell as complete */
  onComplete?: () => void;
  /** Called when the owner wants to undo a completed base/team cell */
  onUndo?: () => void;
  /** Called when a non-owner wants to request proof */
  onRequestProof?: () => void;
  /** Called when someone wants to view the review thread */
  onViewThread?: () => void;
}

/**
 * Visual state config mirroring the bingo cell grid styling.
 * Reuses the same colors and icons so the detail dialog feels consistent.
 */
const STATE_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
}> = {
  [CellState.PENDING]:        { label: "Pending",       icon: null,                                                  bg: "bg-secondary",                           text: "text-secondary-foreground" },
  [CellState.COMPLETED]:      { label: "Completed",     icon: <Check className="h-3.5 w-3.5 text-green-500" />,      bg: "bg-green-100 dark:bg-green-900/50",      text: "text-green-800 dark:text-green-300" },
  [CellState.PENDING_REVIEW]: { label: "Under Review",  icon: <Hourglass className="h-3.5 w-3.5 text-amber-500" />, bg: "bg-amber-100 dark:bg-amber-900/50",      text: "text-amber-800 dark:text-amber-300" },
  [CellState.ACCOMPLISHED]:   { label: "Accomplished",  icon: <ThumbsUp className="h-3.5 w-3.5 text-green-500" />,  bg: "bg-green-100 dark:bg-green-900/50",      text: "text-green-800 dark:text-green-300" },
  declined:                   { label: "Declined",      icon: <X className="h-3.5 w-3.5 text-red-500" />,           bg: "bg-red-100 dark:bg-red-900/50",          text: "text-red-800 dark:text-red-300" },
};

/** Human-readable type labels */
const TYPE_LABELS: Record<string, string> = {
  [ResolutionType.BASE]: "Common",
  [ResolutionType.COMPOUND]: "Complex",
  [ResolutionType.ITERATIVE]: "Iterative",
};

/**
 * Dialog showing the full detail view for any resolution on the bingo card.
 * Renders readonly info, type-specific interactive content, and action buttons.
 */
export const ResolutionDetailDialog = ({
  data,
  cell,
  isOpen,
  setIsOpen,
  isOwner,
  sourceLabel,
  onRefresh,
  onComplete,
  onUndo,
  onRequestProof,
  onViewThread,
}: ResolutionDetailDialogProps) => {
  const isAutomatic = data.type === ResolutionType.COMPOUND || data.type === ResolutionType.ITERATIVE;

  // Determine the effective visual state (proof status overrides cell state badge)
  let effectiveStateKey: string = cell.state;
  if (cell.proofStatus === ProofStatus.PENDING) effectiveStateKey = CellState.PENDING_REVIEW;
  else if (cell.proofStatus === ProofStatus.APPROVED) effectiveStateKey = CellState.ACCOMPLISHED;
  else if (cell.proofStatus === ProofStatus.DECLINED) effectiveStateKey = 'declined';
  const effectiveConfig = STATE_CONFIG[effectiveStateKey] ?? STATE_CONFIG[CellState.PENDING];

  return (
    <CellDialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={data.title}
      description={data.description ?? undefined}
    >
      <div className="space-y-4">
        {/* State + type badges — mirrors the bingo cell visual style */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
            effectiveConfig.bg,
            effectiveConfig.text,
          )}>
            {effectiveConfig.icon}
            {effectiveConfig.label}
          </span>
          <Badge variant="outline">{TYPE_LABELS[data.type] ?? data.type}</Badge>
          {sourceLabel && (
            <Badge variant="secondary">{sourceLabel}</Badge>
          )}
        </div>

        {/* Type-specific content */}
        {data.type === ResolutionType.COMPOUND && (
          <CompoundChecklist
            id={data.id}
            subtasks={data.subtasks}
            isOwner={isOwner}
            onRefresh={onRefresh}
          />
        )}

        {data.type === ResolutionType.ITERATIVE && (
          <IterativeCounter
            id={data.id}
            numberOfRepetition={data.numberOfRepetition}
            completedTimes={data.completedTimes}
            isOwner={isOwner}
            onRefresh={onRefresh}
          />
        )}

        {data.type === ResolutionType.BASE && (
          <div className="py-2">
            {!data.description && (
              <p className="text-sm text-muted-foreground italic">No description provided.</p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <DialogFooter className="gap-2 sm:gap-0">
          {/* Owner + pending + non-automatic → Mark Complete */}
          {isOwner && cell.state === CellState.PENDING && !isAutomatic && onComplete && (
            <Button onClick={() => { setIsOpen(false); onComplete(); }}>
              <Check className="h-4 w-4 mr-2" /> Mark Complete
            </Button>
          )}

          {/* Owner + completed + non-automatic → Undo */}
          {isOwner && cell.state === CellState.COMPLETED && !isAutomatic && onUndo && (
            <Button variant="outline" onClick={() => { setIsOpen(false); onUndo(); }}>
              <Undo2 className="h-4 w-4 mr-2" /> Undo
            </Button>
          )}

          {/* Non-owner + completed → Request Proof */}
          {!isOwner && cell.state === CellState.COMPLETED && onRequestProof && (
            <Button variant="outline" onClick={() => { setIsOpen(false); onRequestProof(); }}>
              <Eye className="h-4 w-4 mr-2" /> Request Proof
            </Button>
          )}

          {/* Any + pending_review → View Thread */}
          {(cell.state === CellState.PENDING_REVIEW || cell.proofStatus === ProofStatus.PENDING) && onViewThread && (
            <Button variant="outline" onClick={() => { setIsOpen(false); onViewThread(); }}>
              <MessageSquare className="h-4 w-4 mr-2" /> View Thread
            </Button>
          )}
        </DialogFooter>
      </div>
    </CellDialog>
  );
};

/* ─── Compound Checklist ─────────────────────────────────────────────── */

interface CompoundChecklistProps {
  id: string;
  subtasks: Subtask[];
  isOwner: boolean;
  onRefresh?: () => void;
}

/**
 * Renders a list of subtasks with checkboxes.
 * Only the owner can toggle subtask completion.
 * Joins a resolution-level WS room to receive real-time updates
 * when the owner toggles subtasks from another session/device.
 */
const CompoundChecklist = ({ id, subtasks, isOwner, onRefresh }: CompoundChecklistProps) => {
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks);
  const [loading, setLoading] = useState<number | null>(null);
  const { sendWsMessage, addMessageListener } = useTeamWs();

  const completedCount = localSubtasks.filter((s) => s.completed).length;
  const totalCount = localSubtasks.length;
  const allDone = completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Join the resolution room and listen for refresh events ────
  useEffect(() => {
    sendWsMessage({
      type: "join-resolution-room",
      body: { resolutionId: id },
    });

    const unsubscribe = addMessageListener((msg: WsIncomingMessage) => {
      if (msg.type === "refresh-resolution" && msg.resolutionId === id) {
        // Re-fetch the resolution data from the API
        fetch(`/api/resolutions/compound?id=${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.resolution?.subtasks) {
              setLocalSubtasks(data.resolution.subtasks);
            }
          })
          .catch(() => { /* ignore */ });
      }
    });

    return unsubscribe;
  }, [id, sendWsMessage, addMessageListener]);

  const handleToggle = useCallback(
    async (index: number) => {
      if (loading !== null) return;
      setLoading(index);
      try {
        const res = await fetch(`/api/resolutions/compound/${id}/toggle`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subtaskIndex: index }),
        });
        if (res.ok) {
          const { resolution } = await res.json();
          setLocalSubtasks(resolution.subtasks);
          onRefresh?.();
          // Notify other viewers of this resolution
          sendWsMessage({
            type: "resolution-refresh",
            body: { resolutionId: id },
          });
        }
      } finally {
        setLoading(null);
      }
    },
    [id, loading, onRefresh, sendWsMessage]
  );

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {completedCount} / {totalCount} subtasks
        </span>
        {allDone && (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <Check className="h-4 w-4" /> All done!
          </span>
        )}
      </div>
      <Progress value={progressPercent} className="h-2" />

      {/* Subtask list */}
      <ul className="space-y-2 max-h-60 overflow-y-auto">
        {localSubtasks.map((subtask, idx) => (
          <li
            key={idx}
            className="flex items-start gap-3 p-2 rounded-md hover:bg-secondary/30 transition-colors"
          >
            <button
              type="button"
              disabled={!isOwner || loading !== null}
              onClick={() => handleToggle(idx)}
              className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center transition-colors ${
                subtask.completed
                  ? "bg-green-500 border-green-500 text-white"
                  : "border-muted-foreground/40 hover:border-primary"
              } ${!isOwner ? "cursor-default opacity-70" : "cursor-pointer"}`}
              aria-label={`Toggle subtask: ${subtask.title}`}
            >
              {loading === idx ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : subtask.completed ? (
                <Check className="h-3 w-3" />
              ) : null}
            </button>
            <div className="flex-1 min-w-0">
              <p
                className={`text-sm font-medium ${
                  subtask.completed ? "line-through text-muted-foreground" : ""
                }`}
              >
                {subtask.title}
              </p>
              {subtask.description && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtask.description}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* ─── Iterative Counter ──────────────────────────────────────────────── */

interface IterativeCounterProps {
  id: string;
  numberOfRepetition: number;
  completedTimes: number;
  isOwner: boolean;
  onRefresh?: () => void;
}

/**
 * Renders a counter display (X / N) with increment/decrement buttons
 * and a progress bar. Only the owner can change the counter.
 * Joins a resolution-level WS room to receive real-time updates
 * when the owner increments/decrements from another session/device.
 */
const IterativeCounter = ({
  id,
  numberOfRepetition,
  completedTimes: initialCompleted,
  isOwner,
  onRefresh,
}: IterativeCounterProps) => {
  const [completedTimes, setCompletedTimes] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);
  const { sendWsMessage, addMessageListener } = useTeamWs();

  const isComplete = completedTimes >= numberOfRepetition;
  const progressPercent = Math.min(
    100,
    Math.round((completedTimes / numberOfRepetition) * 100)
  );

  // ── Join the resolution room and listen for refresh events ────
  useEffect(() => {
    sendWsMessage({
      type: "join-resolution-room",
      body: { resolutionId: id },
    });

    const unsubscribe = addMessageListener((msg: WsIncomingMessage) => {
      if (msg.type === "refresh-resolution" && msg.resolutionId === id) {
        // Re-fetch the resolution data from the API
        fetch(`/api/resolutions/iterative?id=${id}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.resolution && typeof data.resolution.completedTimes === "number") {
              setCompletedTimes(data.resolution.completedTimes);
            }
          })
          .catch(() => { /* ignore */ });
      }
    });

    return unsubscribe;
  }, [id, sendWsMessage, addMessageListener]);

  const handleAction = useCallback(
    async (action: "increment" | "decrement") => {
      if (loading) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/resolutions/iterative/${id}/${action}`, {
          method: "PATCH",
        });
        if (res.ok) {
          const { resolution } = await res.json();
          setCompletedTimes(resolution.completedTimes);
          onRefresh?.();
          // Notify other viewers of this resolution
          sendWsMessage({
            type: "resolution-refresh",
            body: { resolutionId: id },
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [id, loading, onRefresh, sendWsMessage]
  );

  return (
    <div className="space-y-6">
      {/* Counter display */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl font-bold tabular-nums">
          <span className={isComplete ? "text-green-600" : ""}>{completedTimes}</span>
          <span className="text-muted-foreground"> / {numberOfRepetition}</span>
        </div>

        {isComplete && (
          <span className="flex items-center gap-1 text-green-600 font-medium text-sm">
            <Check className="h-4 w-4" /> Target reached!
          </span>
        )}

        {/* +/- buttons */}
        {isOwner && (
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              disabled={loading || completedTimes <= 0}
              onClick={() => handleAction("decrement")}
              aria-label="Decrement counter"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={loading}
              onClick={() => handleAction("increment")}
              aria-label="Increment counter"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={progressPercent} className="h-3" />
        <p className="text-xs text-muted-foreground text-center">{progressPercent}% complete</p>
      </div>
    </div>
  );
};
