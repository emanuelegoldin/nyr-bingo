"use client";

/**
 * Read-only details of an archived cell, as plain text.
 * ResolutionDetailDialog is not reused: its compound and iterative views follow a live resolution.
 * Spec Reference: 18-game-archive.md - Archived Game Page
 */

import { CellDialog } from "@/components/dialogs/cell-dialog";
import { STATE_CONFIG } from "@/components/dialogs/resolution-detail-dialog";
import { Badge } from "@/components/ui/badge";
import { RESOLUTION_TYPE_LABELS } from "@/lib/shared/resolution-type";
import type { ArchivedCell } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ArchivedCellDialogProps {
  cell: ArchivedCell;
  onClose: () => void;
}

/**
 * Shows an archived resolution's text, final state and final progress.
 *
 * @param props - The cell, and the handler that closes the dialog.
 * @returns The dialog.
 */
export function ArchivedCellDialog({ cell, onClose }: ArchivedCellDialogProps) {
  const stateConfig = STATE_CONFIG[cell.state];
  const hasDescription = cell.resolutionText !== cell.resolutionTitle;

  return (
    <CellDialog
      isOpen={true}
      setIsOpen={(open) => {
        if (!open) onClose();
      }}
      title={cell.resolutionTitle}
      description={hasDescription ? cell.resolutionText : undefined}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium",
            stateConfig.bg,
            stateConfig.text,
          )}>
            {stateConfig.icon}
            {stateConfig.label}
          </span>
          <Badge variant="outline">{RESOLUTION_TYPE_LABELS[cell.resolutionType]}</Badge>
          <Badge variant="secondary">{cell.sourceLabel}</Badge>
        </div>

        {cell.subtasks && (
          <ul className="space-y-2">
            {cell.subtasks.map((subtask, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <Check className={cn("h-4 w-4 mt-0.5 shrink-0", subtask.completed ? "text-green-600" : "invisible")} />
                <div className="min-w-0">
                  <p className="font-medium">{subtask.title}</p>
                  {subtask.description && (
                    <p className="text-xs text-muted-foreground">{subtask.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {cell.numberOfRepetition !== null && (
          <p className="text-sm font-medium">
            {cell.completedTimes ?? 0} / {cell.numberOfRepetition}
          </p>
        )}
      </div>
    </CellDialog>
  );
}
