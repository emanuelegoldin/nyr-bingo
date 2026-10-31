"use client";

import { apiFetch } from "@/lib/api-client";
import { useResolutionRoom } from "@/hooks/use-resolution-room";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTeamWs } from "../../team-ws-provider";
import { Button } from "../../ui/button";
import { Progress } from "../../ui/progress";

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
export const IterativeCounter = ({
  id,
  numberOfRepetition,
  completedTimes: initialCompleted,
  isOwner,
  onRefresh,
}: IterativeCounterProps) => {
  const [completedTimes, setCompletedTimes] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);
  const { sendWsMessage } = useTeamWs();

  const isComplete = completedTimes >= numberOfRepetition;
  const progressPercent = Math.min(
    100,
    Math.round((completedTimes / numberOfRepetition) * 100)
  );

  // ── Join the resolution room and listen for refresh events ────
  useResolutionRoom(id, () => {
    // Re-fetch the resolution data from the API
    apiFetch<{ resolution?: { completedTimes?: unknown } }>(`/api/resolutions/iterative?id=${id}`)
      .then((result) => {
        const completed = result.ok ? result.data?.resolution?.completedTimes : undefined;
        if (typeof completed === "number") {
          setCompletedTimes(completed);
        }
      });
  });

  const handleAction = useCallback(
    async (action: "increment" | "decrement") => {
      if (loading) return;
      setLoading(true);
      try {
        const result = await apiFetch<{ resolution: { completedTimes: number } }>(
          `/api/resolutions/iterative/${id}/${action}`,
          { method: "PATCH" },
        );
        if (result.ok) {
          setCompletedTimes(result.data.resolution.completedTimes);
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
