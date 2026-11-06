"use client";

import { apiFetch } from "@/lib/api-client";
import { useWsRoom } from "@/hooks/use-ws-room";
import { useTeamWs } from "@/components/team-ws-provider";
import type { BingoCellDetail } from "@/lib/db/types";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";

interface IterativeCounterProps {
  cellId: string;
  numberOfRepetition: number;
  completedTimes: number;
  isOwner: boolean;
  onRefresh?: () => void;
}

/**
 * Renders a counter display (X / N) with increment/decrement buttons
 * and a progress bar. Only the owner can change the counter.
 * Listens on the team's card room to receive real-time updates
 * when the owner increments/decrements from another session/device.
 */
export const IterativeCounter = ({
  cellId,
  numberOfRepetition,
  completedTimes: initialCompleted,
  isOwner,
  onRefresh,
}: IterativeCounterProps) => {
  const t = useTranslations("Cell");
  const { teamId } = useTeamWs();
  const [completedTimes, setCompletedTimes] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);

  const isComplete = completedTimes >= numberOfRepetition;
  const progressPercent = Math.min(
    100,
    Math.round((completedTimes / numberOfRepetition) * 100)
  );

  // ── Listen on the card room and re-fetch the cell ─────────────
  useWsRoom(teamId ? { type: "card", id: teamId } : null, () => {
    apiFetch<{ cell: BingoCellDetail }>(`/api/cells/${cellId}`).then((result) => {
      if (result.ok) {
        setCompletedTimes(result.data.cell.completedTimes);
      }
    });
  });

  const handleAction = useCallback(
    async (action: "increment" | "decrement") => {
      if (loading) return;
      setLoading(true);
      try {
        const result = await apiFetch<{ cell: BingoCellDetail }>(
          `/api/cells/${cellId}/progress/${action}`,
          { method: "PATCH" },
        );
        if (result.ok) {
          setCompletedTimes(result.data.cell.completedTimes);
          onRefresh?.();
        }
      } finally {
        setLoading(false);
      }
    },
    [cellId, loading, onRefresh]
  );

  return (
    <div className="space-y-6">
      {/* Counter display */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-4xl font-bold tabular-nums">
          <span className={isComplete ? "text-success" : ""}>{completedTimes}</span>
          <span className="text-muted-foreground"> / {numberOfRepetition}</span>
        </div>

        {isComplete && (
          <span className="flex items-center gap-1 text-success font-medium text-sm">
            <Check className="h-4 w-4" /> {t("iterative.targetReached")}
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
              aria-label={t("iterative.decrement")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              disabled={loading}
              onClick={() => handleAction("increment")}
              aria-label={t("iterative.increment")}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress value={progressPercent} className="h-3" />
        <p className="text-xs text-muted-foreground text-center">{t("iterative.percentComplete", { percent: progressPercent })}</p>
      </div>
    </div>
  );
};
