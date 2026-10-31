// This component shows confetti on an overlay when the user achieves a bingo

import { BingoCell } from "@/lib/db/types";
import { hasBingoLine } from "@/lib/shared/bingo-lines";
import { useEffect, useState } from "react";
import { Confetti } from "../confetti";

/**
 * Whether a card has a complete bingo line, using the same lines as the leaderboard.
 *
 * @param cells - The cells of the card.
 * @returns True if the card has a bingo.
 */
function cardHasBingo(cells: BingoCell[]): boolean {
    const donePositions = new Set(
        cells
            .filter((c) => !c.isEmpty && (c.state === "completed" || c.state === "accomplished"))
            .map((c) => c.position)
    );
    return hasBingoLine(donePositions);
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