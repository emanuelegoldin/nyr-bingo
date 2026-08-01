import { PropsWithChildren } from "react"

export interface CellProps {
    cellClassName: string,
    isDisabled: boolean,
    onClick: () => void
}

export const Cell = ({
    cellClassName,
    isDisabled,
    children,
    onClick
}: PropsWithChildren<CellProps>) => {
    return (
        <button
            onClick={onClick}
            disabled={isDisabled}
            className={cellClassName}
        >
        {children}
        </button>
    )
}