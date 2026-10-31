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

import { CELL_STATE_COLORS, getCellStateIcon } from "@/components/cell/cell-state-style";
import { RESOLUTION_TYPE_LABELS } from "@/lib/shared/resolution-type";
import type { Subtask } from "@/lib/shared/types";
import { CellState, ResolutionType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Check, Eye, History, MessageSquare, Undo2 } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { CellDialog } from "./cell-dialog";
import { CompoundChecklist } from "./resolution-detail/compound-checklist";
import { IterativeCounter } from "./resolution-detail/iterative-counter";

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
  ownerUserId: string;
  subtasks: Subtask[];
}

interface IterativeData {
  type: ResolutionType.ITERATIVE;
  id: string;
  title: string;
  description?: string | null;
  ownerUserId: string;
  numberOfRepetition: number;
  completedTimes: number;
}

export type ResolutionDetailData = BaseData | CompoundData | IterativeData;

/* ─── Cell context passed from the bingo card ────────────────────── */

export interface CellContext {
  cellId: string;
  state: CellState;
  reviewThreadId?: string | null;
}

/* ─── Props ──────────────────────────────────────────────────────── */

interface ResolutionDetailDialogProps {
  data: ResolutionDetailData;
  cell: CellContext;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isOwner: boolean;
  /** Whether the viewer's progress changes take effect (only the leader's do on team goals) */
  canChangeProgress: boolean;
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
  /** Called when someone wants to view resolution history */
  onViewHistory?: () => void;
}

/**
 * Visual state config mirroring the bingo cell grid styling.
 * Reuses the same colors and icons so the detail dialog feels consistent.
 */
const STATE_CONFIG: Record<CellState, {
  label: string;
  icon: React.ReactNode;
  bg: string;
  text: string;
}> = {
  [CellState.PENDING]:        { label: "Pending",       icon: null,                                                  bg: "bg-secondary",                           text: "text-secondary-foreground" },
  [CellState.COMPLETED]:      { label: "Completed",     icon: getCellStateIcon("completed", "h-3.5 w-3.5"),      ...CELL_STATE_COLORS.completed },
  [CellState.PENDING_REVIEW]: { label: "Under Review",  icon: getCellStateIcon("pending_review", "h-3.5 w-3.5"), ...CELL_STATE_COLORS.pending_review },
  [CellState.ACCOMPLISHED]:   { label: "Accomplished",  icon: getCellStateIcon("accomplished", "h-3.5 w-3.5"),   ...CELL_STATE_COLORS.accomplished },
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
  canChangeProgress,
  sourceLabel,
  onRefresh,
  onComplete,
  onUndo,
  onRequestProof,
  onViewThread,
  onViewHistory,
}: ResolutionDetailDialogProps) => {
  const isAutomatic = data.type === ResolutionType.COMPOUND || data.type === ResolutionType.ITERATIVE;

  const stateConfig = STATE_CONFIG[cell.state];

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
            stateConfig.bg,
            stateConfig.text,
          )}>
            {stateConfig.icon}
            {stateConfig.label}
          </span>
          <Badge variant="outline">{RESOLUTION_TYPE_LABELS[data.type] ?? data.type}</Badge>
          {sourceLabel && (
            <Badge variant="secondary">{sourceLabel}</Badge>
          )}
        </div>

        {/* Type-specific content */}
        {data.type === ResolutionType.COMPOUND && (
          <CompoundChecklist
            id={data.id}
            subtasks={data.subtasks}
            isOwner={canChangeProgress}
            onRefresh={onRefresh}
          />
        )}

        {data.type === ResolutionType.ITERATIVE && (
          <IterativeCounter
            id={data.id}
            numberOfRepetition={data.numberOfRepetition}
            completedTimes={data.completedTimes}
            isOwner={canChangeProgress}
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
          {onViewHistory && (
            <Button variant="outline" onClick={() => { setIsOpen(false); onViewHistory(); }}>
              <History className="h-4 w-4 mr-2" /> History
            </Button>
          )}

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
          {cell.state === CellState.PENDING_REVIEW && onViewThread && (
            <Button variant="outline" onClick={() => { setIsOpen(false); onViewThread(); }}>
              <MessageSquare className="h-4 w-4 mr-2" /> View Thread
            </Button>
          )}
        </DialogFooter>
      </div>
    </CellDialog>
  );
};
