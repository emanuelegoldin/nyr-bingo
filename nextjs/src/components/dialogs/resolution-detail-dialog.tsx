/**
 * Resolution Detail Dialog
 * Displays compound checklist or iterative counter/progress UI.
 * Spec Reference: Resolution Rework — compound and iterative types
 */

"use client";

import { useState, useCallback } from "react";
import { CellDialog } from "./cell-dialog";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";
import { DialogFooter } from "../ui/dialog";
import { Check, Minus, Plus, Loader2 } from "lucide-react";
import { ResolutionType } from "@/lib/shared/types";
import type { Subtask } from "@/lib/shared/types";

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

type ResolutionData = CompoundData | IterativeData;

interface ResolutionDetailDialogProps {
  data: ResolutionData;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isOwner: boolean;
  /** Called after a mutation so the parent can refresh the bingo card */
  onRefresh?: () => void;
}

/**
 * Dialog showing the full detail view for compound or iterative resolutions.
 * - Compound: renders a checklist of subtasks with toggle support (owner only).
 * - Iterative: renders a counter (X / N) with +/- buttons and a progress bar.
 */
export const ResolutionDetailDialog = ({
  data,
  isOpen,
  setIsOpen,
  isOwner,
  onRefresh,
}: ResolutionDetailDialogProps) => {
  return (
    <CellDialog
      isOpen={isOpen}
      setIsOpen={setIsOpen}
      title={data.title}
      description={data.description ?? undefined}
    >
      {data.type === ResolutionType.COMPOUND ? (
        <CompoundChecklist
          id={data.id}
          subtasks={data.subtasks}
          isOwner={isOwner}
          onRefresh={onRefresh}
        />
      ) : (
        <IterativeCounter
          id={data.id}
          numberOfRepetition={data.numberOfRepetition}
          completedTimes={data.completedTimes}
          isOwner={isOwner}
          onRefresh={onRefresh}
        />
      )}
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
 */
const CompoundChecklist = ({ id, subtasks, isOwner, onRefresh }: CompoundChecklistProps) => {
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks);
  const [loading, setLoading] = useState<number | null>(null);

  const completedCount = localSubtasks.filter((s) => s.completed).length;
  const totalCount = localSubtasks.length;
  const allDone = completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

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
        }
      } finally {
        setLoading(null);
      }
    },
    [id, loading, onRefresh]
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

  const isComplete = completedTimes >= numberOfRepetition;
  const progressPercent = Math.min(
    100,
    Math.round((completedTimes / numberOfRepetition) * 100)
  );

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
        }
      } finally {
        setLoading(false);
      }
    },
    [id, loading, onRefresh]
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
