// This component plays the confetti effect when a card achieves a bingo

import { BingoCell } from "@/lib/db/types";
import { hasBingoLine } from "@/lib/shared/bingo-lines";
import { useEffect, useRef } from "react";
import { fireBingoConfetti } from "../confetti";

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
    const hadBingo = useRef(cardHasBingo(cells));

    useEffect(() => {
        const hasBingoAfterChange = cardHasBingo(cells);

        if (!hadBingo.current && hasBingoAfterChange) {
            void fireBingoConfetti();
        }

        hadBingo.current = hasBingoAfterChange;
    }, [cells]); // trigger effect whenever cells change

    return null;
}
