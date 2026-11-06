/**
 * The N x N grid that lays out the cells of a live or archived bingo card.
 * Spec Reference: 16-games.md - Game Model, 20-mobile-layout.md - Bingo Card, 06-bingo-gameplay.md - Card Display Rules
 */

import type { ReactNode } from "react";

/** Grid classes per card size, written out in full so Tailwind generates them. */
const GRID_CLASSES: Record<number, string> = {
  3: "grid-cols-3 grid-rows-3",
  5: "grid-cols-5 grid-rows-5",
  9: "grid-cols-9 grid-rows-9",
};

/**
 * Ruled look of a printed bingo card (spec 06 - Card Grid): the cells cover the primary-coloured
 * background, which shows only through the 1px gaps and as the thicker frame.
 */
const RULED_GRID_CLASSES = "gap-px bg-primary border-2 md:border-4 border-primary rounded-md overflow-hidden";

interface CardGridProps {
  /** The side length of the card: 3, 5 or 9. */
  gridSize: number;
  /** The cells, in position order. */
  children: ReactNode;
}

/**
 * Lays out the cells of a card. The grid is a named group (`group/card`) with a `data-size`
 * attribute, so cells can use a more compact style on a 9x9 card on mobile.
 *
 * @param props - The card size and its cells.
 * @returns The grid.
 */
export function CardGrid({ gridSize, children }: CardGridProps) {
  return (
    <div data-size={gridSize} className={`group/card grid ${RULED_GRID_CLASSES} ${GRID_CLASSES[gridSize] ?? GRID_CLASSES[5]}`}>
      {children}
    </div>
  );
}
