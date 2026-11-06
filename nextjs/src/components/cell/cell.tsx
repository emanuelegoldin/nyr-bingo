/**
 * The button that every bingo cell is drawn as, and the layout classes the cells share.
 * Spec Reference: 06-bingo-gameplay.md - Card Display Rules
 */

import { PropsWithChildren } from "react"

/** Layout classes shared by every cell of the grid; each cell adds its own colours. */
export const CELL_BASE_CLASSES = "relative flex flex-col items-center justify-center aspect-square p-1 sm:p-2 max-md:group-data-[size=9]/card:p-0.5 rounded-lg border shadow-sm text-center transition-all duration-300";

export interface CellProps {
    cellClassName: string,
    isDisabled: boolean,
    onClick: () => void,
    /** Accessible name, for a cell that shows no text. */
    ariaLabel?: string
}

export const Cell = ({
    cellClassName,
    isDisabled,
    children,
    onClick,
    ariaLabel
}: PropsWithChildren<CellProps>) => {
    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            aria-label={ariaLabel}
            className={cellClassName}
        >
        {children}
        </button>
    )
}
