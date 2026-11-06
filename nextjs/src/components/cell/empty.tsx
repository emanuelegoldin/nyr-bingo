import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Cell, CELL_BASE_CLASSES } from "./cell";

interface EmptyCellProps {
  canInteract: boolean,
  onClick: () => void,
}

/**
 * Empty slot of a bingo card, selectable when the owner edits the card.
 *
 * @param props - Whether the slot can be clicked, and its click handler.
 * @returns The empty cell.
 */
export const EmptyCell = ({
  canInteract,
  onClick
}: EmptyCellProps) => {
  const t = useTranslations("Cell");
  return (
    <Cell
      cellClassName={cn(
        CELL_BASE_CLASSES,
        "bg-muted",
        canInteract ? "cursor-pointer hover:brightness-95 dark:hover:brightness-125" : "cursor-default"
      )}
      isDisabled={!canInteract}
      onClick={onClick}>
      <p className="text-[10px] sm:text-xs md:text-sm max-md:group-data-[size=9]/card:text-[8px] font-medium text-card-foreground">
        {t("empty")}
      </p>
    </Cell>
  );
};
