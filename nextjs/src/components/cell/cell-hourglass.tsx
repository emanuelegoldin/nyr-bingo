/**
 * Yellow hourglass drawn over a cell whose proof was requested, with an optional settling animation.
 * Spec Reference: 06-bingo-gameplay.md - Card Display Rules
 */

import { cn } from "@/lib/utils";
import type { CellStampMotion } from "./cell-stamp";

interface CellHourglassProps {
  /** How the hourglass appears; defaults to `still`. */
  motion?: CellStampMotion;
  /** Called when the animation has finished. */
  onAnimationEnd?: () => void;
}

/**
 * Renders the hourglass over its parent cell, which must be positioned. Like the stamp,
 * content that should stay readable over it must come after it and be positioned too.
 *
 * @param motion - Whether the hourglass is at rest, hidden while waiting, or animating in.
 * @param onAnimationEnd - Called when the animation has finished.
 * @returns The hourglass overlay.
 */
export const CellHourglass = ({ motion = "still", onAnimationEnd }: CellHourglassProps) => (
  <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <svg
      viewBox="0 0 100 100"
      className={cn(
        "w-[60%] h-[60%] opacity-60 text-yellow-500 dark:text-yellow-400",
        motion === "waiting" && "invisible",
        motion === "stamping" && "animate-hourglass-in motion-reduce:animate-none"
      )}
      onAnimationEnd={onAnimationEnd}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M24 10 H76 M24 90 H76" strokeWidth="8" />
      <path d="M31 10 C31 34 46 42 46 50 C46 58 31 66 31 90 M69 10 C69 34 54 42 54 50 C54 58 69 66 69 90" strokeWidth="6" />
      <path d="M50 66 L64 84 H36 Z" fill="currentColor" strokeWidth="3" />
    </svg>
  </div>
);
