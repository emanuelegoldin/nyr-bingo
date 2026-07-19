// This component shows confetti on an overlay when the user achieves a bingo

import { BingoCell } from "@/lib/db/types";
import { useEffect, useState } from "react";
import { Confetti } from "../confetti";

function cardHasBingo(cells: BingoCell[]): boolean {
    // Filter out only cells that could contribute to a bingo
    const cellsToCheck = cells.filter(c =>
        !c.isJoker
        && !c.isEmpty
        && (c.state === "completed" || c.state === "accomplished")
    );

    for (let row = 0; row < 5; row++) {
        if (cellsToCheck.filter(c => Math.floor(c.position / 5) === row).length === 5) {
            return true;
        }
    }

    for (let col = 0; col < 5; col++) {
        if (cellsToCheck.filter(c => c.position % 5 === col).length === 5) {
            return true;
        }
    }

    if (cellsToCheck.filter(c => isOnDiagonalLeftToRight(c.position)).length === 5) {
        return true;
    }

    if (cellsToCheck.filter(c => isOnDiagonalRightToLeft(c.position)).length === 5) {
        return true;
    }

    return false;
}

// \
function isOnDiagonalLeftToRight(position: number): boolean {
    return position % 6 === 0;
}

// /
function isOnDiagonalRightToLeft(position: number): boolean {
    return position % 4 === 0;
}

export function ConfettiLayer({ cells }: { cells: BingoCell[] }) {
    const [showConfetti, setShowConfetti] = useState(false);
    const [hadBingo, setHadBingo] = useState(cardHasBingo(cells));

    useEffect(() => {
        const hasBingoAfterChange = cardHasBingo(cells);

        if (!hadBingo && hasBingoAfterChange) {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 5000); // Show confetti for 5 seconds
            setHadBingo(true);
            return;
        }

        if (hadBingo && !hasBingoAfterChange) {
            setHadBingo(false);
            return;
        }
    }, [cells]); // trigger effect whenever cells change

    return (
        <>
            {showConfetti && <Confetti />}
        </>
    );
}