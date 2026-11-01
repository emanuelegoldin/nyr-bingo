import { BingoCell } from "@/lib/db/types";
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
    editMode: boolean,
    isOwner: boolean,
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
 * @param editMode - Whether the card is in edit mode (used by the empty slot).
 * @param isOwner - Whether the viewer owns the card (used by the empty slot).
 * @param canInteract - Whether the cell can be clicked.
 * @param sourceLabel - Label of the cell source, shown in the badge.
 * @param onClick - Click handler of the cell.
 * @returns The cell face.
 */
export const CellFace = ({
    cell,
    editMode,
    isOwner,
    canInteract,
    sourceLabel,
    onClick
}: CellFaceProps) => {
    const stateConfig = {
        pending: { icon: null, color: "bg-card hover:bg-secondary/50", text: "text-card-foreground" },
        completed: { icon: getCellStateIcon("completed", "h-4 w-4"), color: CELL_STATE_COLORS.completed.bg, text: CELL_STATE_COLORS.completed.text },
        pending_review: { icon: getCellStateIcon("pending_review", "h-4 w-4"), color: CELL_STATE_COLORS.pending_review.bg, text: CELL_STATE_COLORS.pending_review.text },
        accomplished: { icon: getCellStateIcon("accomplished", "h-4 w-4"), color: CELL_STATE_COLORS.accomplished.bg, text: `${CELL_STATE_COLORS.accomplished.text} line-through` },
        failed: { icon: getCellStateIcon("failed", "h-4 w-4"), color: CELL_STATE_COLORS.failed.bg, text: CELL_STATE_COLORS.failed.text },
    };
    const config = stateConfig[cell.state];
    // Resolution title for cell display (truncated with CSS ellipsis)
    const displayTitle = cell.resolutionTitle || cell.resolutionText;

    if (cell.isEmpty) {
        return (
            <EmptyCell
                editMode={editMode}
                isOwner={isOwner}
                onClick={onClick} />
        );
    }

    return (
        <Cell
            cellClassName={cn(
                "relative flex flex-col items-center justify-center aspect-square p-2 rounded-lg border shadow-sm text-center transition-all duration-300",
                config.color,
                canInteract ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-default"
            )}
            isDisabled={!canInteract}
            onClick={onClick}>

            <p className={cn("text-xs md:text-sm font-medium truncate max-w-full", config.text)}>
                {displayTitle}
            </p>
            <div className="absolute top-1 right-1">
                {cell.state !== 'pending' && config.icon}
            </div>
            <Badge variant="outline" className="absolute bottom-1 right-1 max-w-[calc(100%-0.5rem)] text-xs hidden sm:inline-flex">
                {cell.sourceType === CellSourceType.MEMBER_PROVIDED && cell.sourceUserId ? (
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
