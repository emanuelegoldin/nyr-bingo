"use client";

/**
 * A list of resolution definitions with their type, subtask count or target, and optional Edit and Delete buttons.
 * Used by a game's Personal tab and by the obsolete /resolutions page.
 * Spec Reference: 03-personal-resolutions.md - Read, Delete, Legacy Personal Resolutions
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { RESOLUTION_TYPE_BADGE_VARIANTS } from "@/lib/shared/resolution-type";
import type { UnifiedResolution } from "@/lib/shared/types";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface ResolutionListProps {
  resolutions: UnifiedResolution[];
  /** Shown when the list is empty. */
  emptyText: string;
  /** Opens the resolution for editing; without it the rows have no Edit button. */
  onEdit?: (resolution: UnifiedResolution) => void;
  /** Called after a resolution was deleted, to reload the list. */
  onDeleted: (resolution: UnifiedResolution) => void;
}

/**
 * Render the resolutions, newest first as given, each with a Delete button and, when `onEdit` is set, an Edit button.
 * Deleting goes through DELETE /api/resolutions and shows a toast.
 */
export const ResolutionList = ({ resolutions, emptyText, onEdit, onDeleted }: ResolutionListProps) => {
  const t = useTranslations("ResolutionList");
  const tl = useTranslations("Labels");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  const { toast } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /**
   * Delete a resolution through the generic endpoint, which accepts every type.
   * @param resolution The resolution to delete
   */
  const handleDelete = async (resolution: UnifiedResolution) => {
    setDeletingId(resolution.id);
    const result = await apiFetch<unknown>(`/api/resolutions?id=${resolution.id}`, { method: "DELETE" });

    if (result.ok) {
      toast({ title: tc("success"), description: t("deleted") });
      onDeleted(resolution);
    } else {
      toastApiError(result, t("deleteError"));
    }
    setDeletingId(null);
  };

  if (resolutions.length === 0) {
    return <p className="text-sm text-center text-muted-foreground py-4">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {resolutions.map((resolution) => (
        <li
          key={resolution.id}
          className="flex items-center justify-between p-2 rounded-md bg-secondary/50"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 md:flex-nowrap">
              <span className="min-w-0 text-sm font-medium break-words md:truncate">{resolution.title}</span>
              <Badge variant={RESOLUTION_TYPE_BADGE_VARIANTS[resolution.type]} className="text-xs flex-shrink-0">
                {tl(`resolutionType.${resolution.type}`)}
              </Badge>
            </div>
            {resolution.text && resolution.text !== resolution.title && (
              <span className="text-xs text-muted-foreground block truncate mt-0.5">{resolution.text}</span>
            )}
            {resolution.type === "compound" && resolution.subtasks && (
              <span className="text-xs text-muted-foreground block mt-0.5">
                {t("subtaskCount", { count: resolution.subtasks.length })}
              </span>
            )}
            {resolution.type === "iterative" && resolution.numberOfRepetition !== undefined && (
              <span className="text-xs text-muted-foreground block mt-0.5">
                {t("repetitionTarget", { count: resolution.numberOfRepetition })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(resolution)}
                disabled={deletingId === resolution.id}
                aria-label={t("editAriaLabel")}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(resolution)}
              disabled={deletingId === resolution.id}
              aria-label={t("deleteAriaLabel")}
            >
              {deletingId === resolution.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};
