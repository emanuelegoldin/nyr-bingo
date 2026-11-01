import { Check, Hourglass, ThumbsUp, X } from "lucide-react";
import type { ReactNode } from "react";

/** Visual states (other than pending) that share colours between the grid cell and the detail dialog. */
export type CellVisualState = "completed" | "pending_review" | "accomplished" | "failed";

/** Background and text colour classes per visual state. */
export const CELL_STATE_COLORS: Record<CellVisualState, { bg: string; text: string }> = {
  completed: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-800 dark:text-green-300" },
  pending_review: { bg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-800 dark:text-amber-300" },
  accomplished: { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-800 dark:text-green-300" },
  failed: { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-800 dark:text-red-300" },
};

/**
 * Returns the status icon for a visual state.
 *
 * @param state - The visual state to render the icon for.
 * @param sizeClassName - Tailwind size classes for the icon (e.g. "h-4 w-4").
 * @returns The icon element.
 */
export function getCellStateIcon(state: CellVisualState, sizeClassName: string): ReactNode {
  switch (state) {
    case "completed":
      return <Check className={`${sizeClassName} text-green-500`} />;
    case "pending_review":
      return <Hourglass className={`${sizeClassName} text-amber-500`} />;
    case "accomplished":
      return <ThumbsUp className={`${sizeClassName} text-green-500`} />;
    case "failed":
      return <X className={`${sizeClassName} text-red-500`} />;
  }
}
