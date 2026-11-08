"use client";

/**
 * The Ready / Not ready toggle of the preparation phase, with how many players are ready.
 * Spec Reference: 16-games.md - Ready
 */

import { Button } from "@/components/ui/button";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import { Check, Loader2, Undo2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface ReadyButtonProps {
  gameId: string;
  /** Whether the caller is ready */
  isReady: boolean;
  readyCount: number;
  playerCount: number;
  /** Reloads the page after a change, to show the new count or the started game */
  onChanged: () => void;
}

/**
 * Mark the caller ready, or no longer ready. The last player to become ready starts the game (on the server).
 */
export function ReadyButton({ gameId, isReady, readyCount, playerCount, onChanged }: ReadyButtonProps) {
  const t = useTranslations("Games.detail.ready");
  const toastApiError = useApiErrorToast();
  const [isSaving, setIsSaving] = useState(false);

  /** Send the opposite of the current state. */
  const handleToggle = async () => {
    setIsSaving(true);
    const result = await apiFetch<{ ready: boolean; started: boolean }>(`/api/games/${gameId}/ready`, {
      method: "POST",
      json: { ready: !isReady },
    });
    setIsSaving(false);

    if (result.ok) {
      onChanged();
    } else {
      toastApiError(result, t("failed"));
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground" title={t("hint")}>
        {t("count", { ready: readyCount, total: playerCount })}
      </span>
      <Button size="sm" variant={isReady ? "outline" : "default"} onClick={handleToggle} disabled={isSaving}>
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isSaving && (isReady ? <Undo2 className="mr-2 h-4 w-4" /> : <Check className="mr-2 h-4 w-4" />)}
        {isReady ? t("notReady") : t("ready")}
      </Button>
    </div>
  );
}
