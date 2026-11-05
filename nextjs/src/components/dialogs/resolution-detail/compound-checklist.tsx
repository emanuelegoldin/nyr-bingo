"use client";

import { apiFetch } from "@/lib/api-client";
import type { CellSubtask } from "@/lib/shared/types";
import type { BingoCellDetail } from "@/lib/db/types";
import { useWsRoom } from "@/hooks/use-ws-room";
import { useTeamWs } from "@/components/team-ws-provider";
import { Check, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Progress } from "../../ui/progress";

interface CompoundChecklistProps {
  cellId: string;
  subtasks: CellSubtask[];
  isOwner: boolean;
  onRefresh?: () => void;
}

/**
 * Renders the subtasks of a cell with checkboxes.
 * Only the card owner can toggle subtask completion.
 * Listens on the team's card room to receive real-time updates
 * when the owner toggles subtasks from another session/device.
 *
 * @param cellId - The cell whose subtasks are shown.
 * @param subtasks - The subtasks as loaded with the cell.
 * @param isOwner - Whether the viewer may toggle subtasks.
 * @param onRefresh - Called after a toggle so the parent can refresh the card.
 */
export const CompoundChecklist = ({ cellId, subtasks, isOwner, onRefresh }: CompoundChecklistProps) => {
  const t = useTranslations("Cell");
  const { teamId } = useTeamWs();
  const [localSubtasks, setLocalSubtasks] = useState<CellSubtask[]>(subtasks);
  const [loading, setLoading] = useState<number | null>(null);

  const completedCount = localSubtasks.filter((s) => s.completed).length;
  const totalCount = localSubtasks.length;
  const allDone = completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // ── Listen on the card room and re-fetch the cell ─────────────
  useWsRoom(teamId ? { type: "card", id: teamId } : null, () => {
    apiFetch<{ cell: BingoCellDetail }>(`/api/cells/${cellId}`).then((result) => {
      if (result.ok && result.data.cell.subtasks) {
        setLocalSubtasks(result.data.cell.subtasks);
      }
    });
  });

  const handleToggle = useCallback(
    async (index: number) => {
      if (loading !== null) return;
      setLoading(index);
      try {
        const result = await apiFetch<{ cell: BingoCellDetail }>(
          `/api/cells/${cellId}/subtasks/${index}/toggle`,
          { method: "PATCH" },
        );
        if (result.ok) {
          setLocalSubtasks(result.data.cell.subtasks ?? []);
          onRefresh?.();
        }
      } finally {
        setLoading(null);
      }
    },
    [cellId, loading, onRefresh]
  );

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {t("compound.progress", { completed: completedCount, total: totalCount })}
        </span>
        {allDone && (
          <span className="flex items-center gap-1 text-green-600 font-medium">
            <Check className="h-4 w-4" /> {t("compound.allDone")}
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
              aria-label={t("compound.toggleSubtask", { title: subtask.title })}
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
