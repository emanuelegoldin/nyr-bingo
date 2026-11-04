import { cn } from "@/lib/utils";
import { Cell } from "./cell";

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
  return (
    <Cell
      cellClassName={cn(
        "relative flex flex-col items-center justify-center aspect-square p-1 sm:p-2 rounded-lg border shadow-sm text-center transition-all duration-300",
        "bg-muted hover:bg-secondary/50",
        canInteract ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-default"
      )}
      isDisabled={!canInteract}
      onClick={onClick}>
      <p className="text-[10px] sm:text-xs md:text-sm font-medium text-card-foreground">
        Empty
      </p>
    </Cell>
  );
};
