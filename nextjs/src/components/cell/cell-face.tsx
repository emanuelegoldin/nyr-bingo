import { BingoCell } from "@/lib/db/types";
import { FORMER_TEAMMATES_LABEL } from "@/lib/shared/cell-source";
import { CellSourceType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { Cell } from "./cell";
import { CELL_STATE_COLORS, getCellStateIcon } from "./cell-state-style";
import { EmptyCell } from "./empty";

/** The cell fields shown on the grid, shared by live and archived cells. */
type CellFaceData = Pick<BingoCell, "state" | "resolutionTitle" | "resolutionText" | "isEmpty" | "sourceType" | "sourceUserId">;

interface CellFaceProps {
    cell: CellFaceData,
    canInteract: boolean,
    sourceLabel: string,
    onClick: () => void,
}

/**
 * Renders what the grid shows for a cell: the empty slot, or the button with
 * the resolution title, state icon and source badge.
 * The visual state follows the cell state, overridden by the proof status.
 *
 * @param cell - The cell to display.
 * @param canInteract - Whether the cell can be clicked.
 * @param sourceLabel - Label of the cell source, shown in the badge.
 * @param onClick - Click handler of the cell.
 * @returns The cell face.
 */
export const CellFace = ({
    cell,
    canInteract,
    sourceLabel,
    onClick
}: CellFaceProps) => {
    const stateConfig = {
        pending: { icon: null, color: "bg-card hover:bg-secondary/50", text: "text-card-foreground" },
        completed: { icon: getCellStateIcon("completed", "h-3 w-3 sm:h-4 sm:w-4"), color: CELL_STATE_COLORS.completed.bg, text: CELL_STATE_COLORS.completed.text },
        pending_review: { icon: getCellStateIcon("pending_review", "h-3 w-3 sm:h-4 sm:w-4"), color: CELL_STATE_COLORS.pending_review.bg, text: CELL_STATE_COLORS.pending_review.text },
        accomplished: { icon: getCellStateIcon("accomplished", "h-3 w-3 sm:h-4 sm:w-4"), color: CELL_STATE_COLORS.accomplished.bg, text: `${CELL_STATE_COLORS.accomplished.text} line-through` },
        failed: { icon: getCellStateIcon("failed", "h-3 w-3 sm:h-4 sm:w-4"), color: CELL_STATE_COLORS.failed.bg, text: CELL_STATE_COLORS.failed.text },
    };
    const config = stateConfig[cell.state];
    // Resolution title for cell display: up to three lines on phones, one line from md (spec 20)
    const displayTitle = cell.resolutionTitle || cell.resolutionText;

    if (cell.isEmpty) {
        return (
            <EmptyCell
                canInteract={canInteract}
                onClick={onClick} />
        );
    }

    return (
        <Cell
            cellClassName={cn(
                "relative flex flex-col items-center justify-center aspect-square p-1 sm:p-2 rounded-lg border shadow-sm text-center transition-all duration-300",
                config.color,
                canInteract ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-default"
            )}
            isDisabled={!canInteract}
            onClick={onClick}>

            <p className={cn("text-[10px] leading-tight sm:text-xs md:text-sm font-medium break-words line-clamp-3 md:line-clamp-none md:truncate max-w-full", config.text)}>
                {displayTitle}
            </p>
            <div className="absolute top-1 right-1">
                {cell.state !== 'pending' && config.icon}
            </div>
            <Badge variant="outline" className="absolute bottom-1 right-1 max-w-[calc(100%-0.5rem)] text-xs hidden sm:inline-flex">
                {cell.sourceType === CellSourceType.MEMBER_PROVIDED && cell.sourceUserId && sourceLabel !== FORMER_TEAMMATES_LABEL ? (
                    <Link
                        href={`/profile/${cell.sourceUserId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="truncate hover:underline"
                    >
                        {sourceLabel}
                    </Link>
                ) : (
                    <span className="truncate">
                        {cell.sourceType !== CellSourceType.EMPTY && sourceLabel}
                    </span>
                )}
            </Badge>
        </Cell>
    );
};
