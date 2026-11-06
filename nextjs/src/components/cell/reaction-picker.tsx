/**
 * The React row of the cell detail dialog: one button per reaction, to add, change or remove the
 * viewer's reaction on a teammate's stamped cell.
 * Spec Reference: 24-cell-reactions.md - Reacting in the Cell Detail Dialog
 */

"use client";

import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import { REACTION_IDS, type CellReaction, type ReactionId } from "@/lib/shared/reactions";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { ReactionIcon } from "./reaction-icon";

interface ReactionPickerProps {
  cellId: string;
  /** The viewer's reaction on the cell, as loaded with the card. */
  currentReaction: ReactionId | null;
  /** Called after a change so the parent can refresh the card. */
  onRefresh?: () => void;
}

/**
 * Shows the reaction pool with the viewer's current reaction selected. Pressing another reaction
 * adds or changes it; pressing the selected one removes it.
 *
 * @param cellId - The teammate's cell.
 * @param currentReaction - The viewer's reaction on it, or null.
 * @param onRefresh - Called after a successful change.
 * @returns The React row.
 */
export const ReactionPicker = ({ cellId, currentReaction, onRefresh }: ReactionPickerProps) => {
  const t = useTranslations("Cell");
  const toastApiError = useApiErrorToast();
  const [selected, setSelected] = useState<ReactionId | null>(currentReaction);
  const [busy, setBusy] = useState<boolean>(false);

  // A refresh of the card, ours or a live one, brings the stored reaction
  useEffect(() => {
    setSelected(currentReaction);
  }, [currentReaction]);

  /**
   * Add, change or remove the viewer's reaction.
   *
   * @param reaction - The pressed reaction; pressing the selected one removes it.
   */
  const handlePress = async (reaction: ReactionId) => {
    if (busy) return;
    setBusy(true);
    const removing = reaction === selected;
    const result = removing
      ? await apiFetch<{ success: true }>(`/api/cells/${cellId}/reaction`, { method: "DELETE" })
      : await apiFetch<{ reaction: CellReaction }>(`/api/cells/${cellId}/reaction`, {
        method: "PUT",
        json: { reaction },
      });
    setBusy(false);

    if (!result.ok) {
      toastApiError(result, t("reactions.failed"));
      return;
    }
    setSelected(removing ? null : reaction);
    onRefresh?.();
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{t("reactions.label")}</p>
      <div className="flex flex-wrap gap-1">
        {REACTION_IDS.map((reaction) => {
          const isSelected = reaction === selected;
          const name = t(`reactions.names.${reaction}`);
          return (
            <Button
              key={reaction}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={name}
              aria-pressed={isSelected}
              title={name}
              disabled={busy}
              className={cn(isSelected && "bg-secondary ring-2 ring-primary")}
              onClick={() => handlePress(reaction)}
            >
              <ReactionIcon reaction={reaction} className="h-6 w-6" />
            </Button>
          );
        })}
      </div>
    </div>
  );
};
