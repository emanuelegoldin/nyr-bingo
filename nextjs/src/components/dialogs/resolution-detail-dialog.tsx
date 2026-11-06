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

import { STATE_CONFIG } from "@/components/cell/cell-state-style";
import { ReactionPicker } from "@/components/cell/reaction-picker";
import { REACTABLE_CELL_STATES, type ReactionId } from "@/lib/shared/reactions";
import { cellSourceText } from "@/lib/shared/cell-source";
import type { CellSourceLabel, CellSubtask } from "@/lib/shared/types";
import { CellState, ResolutionType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Check, Eye, History, MessageSquare, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { DialogFooter } from "../ui/dialog";
import { CellDialog } from "./cell-dialog";
import { CompoundChecklist } from "./resolution-detail/compound-checklist";
import { IterativeCounter } from "./resolution-detail/iterative-counter";

/* ─── Data types ─────────────────────────────────────────────────── */

interface BaseData {
  type: ResolutionType.BASE;
  title: string;
  description?: string | null;
}

interface CompoundData {
  type: ResolutionType.COMPOUND;
  title: string;
  description?: string | null;
  subtasks: CellSubtask[];
}

interface IterativeData {
  type: ResolutionType.ITERATIVE;
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
  reviewThreadId?: string | null;
}

/* ─── Props ──────────────────────────────────────────────────────── */

/** Dialogs the detail dialog can hand over to. */
export type DetailFollowUpDialog = 'complete' | 'request_proof' | 'thread' | 'history';

interface ResolutionDetailDialogProps {
  data: ResolutionDetailData;
  cell: CellContext;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isOwner: boolean;
  /** The viewer's reaction on the cell (spec 24), or null. */
  currentReaction?: ReactionId | null;
  /** Human-readable source label, e.g. "Personal", "Team Goal", or a username */
  sourceLabel?: CellSourceLabel;
  /** Called after a mutation so the parent can refresh the bingo card */
  onRefresh?: () => void;
  /** Replaces this dialog with a follow-up one (complete, request proof, thread or history) */
  onOpenDialog: (dialog: DetailFollowUpDialog) => void;
  /** Called when the owner undoes a completed or failed cell, or marks a pending cell as failed */
  onSetState: (state: CellState.PENDING | CellState.FAILED) => void;
}

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
  currentReaction = null,
  sourceLabel,
  onRefresh,
  onOpenDialog,
  onSetState,
}: ResolutionDetailDialogProps) => {
  const tl = useTranslations("Labels");
  const t = useTranslations("Cell");
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
            {tl(`cellState.${cell.state}`)}
          </span>
          <Badge variant="outline">{tl(`resolutionType.${data.type}`)}</Badge>
          {sourceLabel && (
            <Badge variant="secondary">{cellSourceText(sourceLabel, tl)}</Badge>
          )}
        </div>

        {/* Type-specific content */}
        {data.type === ResolutionType.COMPOUND && (
          <CompoundChecklist
            cellId={cell.cellId}
            subtasks={data.subtasks}
            isOwner={isOwner}
            onRefresh={onRefresh}
          />
        )}

        {data.type === ResolutionType.ITERATIVE && (
          <IterativeCounter
            cellId={cell.cellId}
            numberOfRepetition={data.numberOfRepetition}
            completedTimes={data.completedTimes}
            isOwner={isOwner}
            onRefresh={onRefresh}
          />
        )}

        {data.type === ResolutionType.BASE && (
          <div className="py-2">
            {!data.description && (
              <p className="text-sm text-muted-foreground italic">{t("detail.noDescription")}</p>
            )}
          </div>
        )}

        {/* Spec 24 - a teammate reacts to a stamped cell */}
        {!isOwner && REACTABLE_CELL_STATES.includes(cell.state) && (
          <ReactionPicker cellId={cell.cellId} currentReaction={currentReaction} onRefresh={onRefresh} />
        )}

        {/* Action buttons */}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenDialog('history')}>
            <History className="h-4 w-4 mr-2" /> {t("detail.history")}
          </Button>

          {/* Owner + pending → Mark Failed */}
          {isOwner && cell.state === CellState.PENDING && (
            <Button variant="outline" onClick={() => { setIsOpen(false); onSetState(CellState.FAILED); }}>
              <X className="h-4 w-4 mr-2" /> {t("detail.markFailed")}
            </Button>
          )}

          {/* Owner + pending or failed + non-automatic → Mark Complete */}
          {isOwner && (cell.state === CellState.PENDING || cell.state === CellState.FAILED) && !isAutomatic && (
            <Button onClick={() => onOpenDialog('complete')}>
              <Check className="h-4 w-4 mr-2" /> {t("markComplete")}
            </Button>
          )}

          {/* Owner + (completed + non-automatic, or failed) → Undo */}
          {isOwner && ((cell.state === CellState.COMPLETED && !isAutomatic) || cell.state === CellState.FAILED) && (
            <Button variant="outline" onClick={() => { setIsOpen(false); onSetState(CellState.PENDING); }}>
              <Undo2 className="h-4 w-4 mr-2" /> {t("detail.undo")}
            </Button>
          )}

          {/* Non-owner + completed → Request Proof */}
          {!isOwner && cell.state === CellState.COMPLETED && (
            <Button variant="outline" onClick={() => onOpenDialog('request_proof')}>
              <Eye className="h-4 w-4 mr-2" /> {t("detail.requestProof")}
            </Button>
          )}

          {/* Any + pending_review → View Thread */}
          {cell.state === CellState.PENDING_REVIEW && (
            <Button variant="outline" onClick={() => onOpenDialog('thread')}>
              <MessageSquare className="h-4 w-4 mr-2" /> {t("detail.viewThread")}
            </Button>
          )}
        </DialogFooter>
      </div>
    </CellDialog>
  );
};
