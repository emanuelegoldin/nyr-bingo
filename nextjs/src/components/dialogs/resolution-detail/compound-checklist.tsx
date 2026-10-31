"use client";

import { apiFetch } from "@/lib/api-client";
import type { Subtask } from "@/lib/shared/types";
import { useWsRoom } from "@/hooks/use-ws-room";
import { Check, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Progress } from "../../ui/progress";

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
export const CompoundChecklist = ({ id, subtasks, isOwner, onRefresh }: CompoundChecklistProps) => {
  const [localSubtasks, setLocalSubtasks] = useState<Subtask[]>(subtasks);
  const [loading, setLoading] = useState<number | null>(null);

  const completedCount = localSubtasks.filter((s) => s.completed).length;
  const totalCount = localSubtasks.length;
  const allDone = completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Join the resolution room and listen for refresh events ────
  useWsRoom({ type: "resolution", id }, () => {
    // Re-fetch the resolution data from the API
    apiFetch<{ resolution?: { subtasks?: Subtask[] } }>(`/api/resolutions/compound?id=${id}`)
      .then((result) => {
        if (result.ok && result.data?.resolution?.subtasks) {
          setLocalSubtasks(result.data.resolution.subtasks);
        }
      });
  });

  const handleToggle = useCallback(
    async (index: number) => {
      if (loading !== null) return;
      setLoading(index);
      try {
        const result = await apiFetch<{ resolution: { subtasks: Subtask[] } }>(
          `/api/resolutions/compound/${id}/toggle`,
          { method: "PATCH", json: { subtaskIndex: index } },
        );
        if (result.ok) {
          setLocalSubtasks(result.data.resolution.subtasks);
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
