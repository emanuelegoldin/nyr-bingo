import { cn } from "@/lib/utils";
import { Cell } from "./cell";

interface EmptyCellProps {
  editMode: boolean,
  isOwner: boolean,
  onClick: () => void,
}

export const EmptyCell = ({
  editMode,
  isOwner,
  onClick
}: EmptyCellProps) => {
  const canInteract = Boolean(editMode && isOwner);
  return (
    <>
      <Cell
        cellClassName={cn(
          "relative flex flex-col items-center justify-center aspect-square p-1 sm:p-2 rounded-lg border shadow-sm text-center transition-all duration-300",
          "bg-card hover:bg-secondary/50",
          "bg-muted cursor-not-allowed",
          canInteract ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-default"
        )}
        isDisabled={!canInteract}
        onClick={onClick}>
        <p className={cn("text-[10px] sm:text-xs md:text-sm font-medium", "text-card-foreground")}>
          Empty
        </p>
      </Cell>
    </>
  )
}