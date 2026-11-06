/**
 * The Joker at the center of a card: a plain cell with a purple outline star.
 * Spec Reference: 05-bingo-card-generation.md - Assumptions
 */

import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { Cell, CELL_BASE_CLASSES } from "./cell";

/**
 * Renders the Joker cell. It shows no text; "Joker" is its accessible name.
 *
 * @returns The Joker cell.
 */
export const JokerCell = () => {
  const t = useTranslations("Cell");
  return (
    <Cell
      cellClassName={cn(CELL_BASE_CLASSES, "bg-card cursor-default")}
      isDisabled={true}
      ariaLabel={t("joker")}
      onClick={() => {}}>
      {/* Sized relative to the cell, so it fits at every card size (spec 20) */}
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <Star className="h-[45%] w-[45%] text-primary" />
      </span>
    </Cell>
  );
};
