/**
 * Round check stamp drawn over a completed or accomplished cell, with an optional stamping animation.
 * Spec Reference: 06-bingo-gameplay.md - Card Display Rules
 */

import { cn } from "@/lib/utils";

/** Cell states that show a stamp. */
export type CellStampVariant = "completed" | "accomplished";

/**
 * How the stamp appears: `still` is shown at rest, `waiting` is hidden until it can be
 * stamped (e.g. a dialog is open), and `stamping` plays the stamping animation.
 */
export type CellStampMotion = "still" | "waiting" | "stamping";

/** Ink colour of the stamp per state. */
const STAMP_INK: Record<CellStampVariant, string> = {
  completed: "text-green-600 dark:text-green-400",
  accomplished: "text-blue-600 dark:text-blue-400",
};

interface CellStampProps {
  variant: CellStampVariant;
  /** How the stamp appears; defaults to `still`. */
  motion?: CellStampMotion;
  /** Called when the stamping animation has finished. */
  onAnimationEnd?: () => void;
}

/**
 * Renders the stamp over its parent cell, which must be positioned. Content that should
 * stay readable over the stamp must come after it and be positioned too.
 *
 * @param variant - The cell state the stamp stands for; it sets the ink colour.
 * @param motion - Whether the stamp is at rest, hidden while waiting, or stamping.
 * @param onAnimationEnd - Called when the animation has finished.
 * @returns The stamp overlay.
 */
export const CellStamp = ({ variant, motion = "still", onAnimationEnd }: CellStampProps) => (
  <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none">
    <svg
      viewBox="0 0 100 100"
      className={cn(
        "w-[70%] h-[70%] -rotate-12 opacity-60",
        STAMP_INK[variant],
        motion === "waiting" && "invisible",
        motion === "stamping" && "animate-stamp-in motion-reduce:animate-none"
      )}
      onAnimationEnd={onAnimationEnd}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="50" cy="50" r="44" strokeWidth="6" />
      <circle cx="50" cy="50" r="36" strokeWidth="2" />
      <path d="M32 51 L45 64 L69 38" strokeWidth="9" />
    </svg>
  </div>
);
