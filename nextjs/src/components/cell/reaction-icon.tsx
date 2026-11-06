/**
 * The drawing of each reaction in the pool, as a small inline SVG.
 * Spec Reference: 24-cell-reactions.md - Reaction Pool
 */

import type { ReactionId } from "@/lib/shared/reactions";
import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

/** The shapes of each reaction, drawn in a 32×32 box. Adding a reaction means one entry here. */
const REACTION_SHAPES: Record<ReactionId, ReactNode> = {
  heart: (
    <path
      d="M16 28C16 28 3 20 3 11.5C3 7.4 6.2 4.5 9.8 4.5C12.5 4.5 14.8 6 16 8.3C17.2 6 19.5 4.5 22.2 4.5C25.8 4.5 29 7.4 29 11.5C29 20 16 28 16 28Z"
      fill="#ef4444"
      stroke="#b91c1c"
      strokeWidth="1.2"
    />
  ),
  thumbs_up: (
    <>
      <rect x="3" y="14" width="6" height="14" rx="1.5" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1.2" />
      <path
        d="M11 14L16 4.5C17.5 2.5 20.5 3.5 20 6.5L19 12H26C28 12 29.5 14 29 16L27 26C26.6 27.6 25.4 28 24 28H11Z"
        fill="#fbbf24"
        stroke="#b45309"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </>
  ),
  fire: (
    <>
      <path
        d="M16 2C17 8 25 11 25 20A9 9 0 0 1 7 20C7 15 10 12.5 11.5 8.5C13.5 11.5 13.5 13.5 15.5 14.5C17 10.5 16 6 16 2Z"
        fill="#f97316"
        stroke="#c2410c"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M16 16C18.5 19 20.5 21 20.5 24A4.5 4.5 0 0 1 11.5 24C11.5 21 13.5 19 16 16Z" fill="#facc15" />
    </>
  ),
  star: (
    <polygon
      points="16,3 19.5,12.1 29.3,12.7 21.7,18.9 24.2,28.3 16,23 7.8,28.3 10.3,18.9 2.7,12.7 12.5,12.1"
      fill="#facc15"
      stroke="#ca8a04"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  ),
  smile: (
    <>
      <circle cx="16" cy="16" r="13.5" fill="#facc15" stroke="#ca8a04" strokeWidth="1.2" />
      <circle cx="11.5" cy="13" r="2" fill="#422006" />
      <circle cx="20.5" cy="13" r="2" fill="#422006" />
      <path d="M9.5 19Q16 26 22.5 19" fill="none" stroke="#422006" strokeWidth="2.4" strokeLinecap="round" />
    </>
  ),
  party: (
    <>
      <path d="M4 28L10 10L22 22Z" fill="#a855f7" stroke="#7e22ce" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M7.5 18.5L13.5 24.5M9.5 13.5L18.5 22.5" stroke="#facc15" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M17 11Q21 9 20 4.5" fill="none" stroke="#f97316" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M21 15Q25 13 28.5 15.5" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="25" cy="6" r="1.8" fill="#ef4444" />
      <circle cx="28" cy="11" r="1.5" fill="#3b82f6" />
      <circle cx="14" cy="5" r="1.5" fill="#22c55e" />
    </>
  ),
};

interface ReactionIconProps {
  reaction: ReactionId;
  className?: string;
  style?: CSSProperties;
}

/**
 * Draws one reaction. It is decorative: callers that need a label add it themselves.
 *
 * @param reaction - The reaction to draw.
 * @param className - Classes for the SVG, typically its size and position.
 * @param style - Inline style for the SVG, typically its position.
 * @returns The reaction's SVG.
 */
export const ReactionIcon = ({ reaction, className, style }: ReactionIconProps) => (
  <svg aria-hidden viewBox="0 0 32 32" className={cn("shrink-0", className)} style={style}>
    {REACTION_SHAPES[reaction]}
  </svg>
);
