"use client";

/**
 * One player's card in an archived game. It reads no live data: cells only open their details.
 * Spec Reference: 18-game-archive.md - Archived Game Page
 */

import { CellFace } from "@/components/cell/cell-face";
import { JokerCell } from "@/components/cell/joker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ArchivedCard, ArchivedCell } from "@/lib/shared/types";
import { useState } from "react";
import { ArchivedCellDialog } from "./archived-cell-dialog";

interface ArchivedCardViewProps {
  card: ArchivedCard;
}

/**
 * Shows a read-only 5×5 grid and the details of the selected cell.
 *
 * @param props - The archived card.
 * @returns The card.
 */
export function ArchivedCardView({ card }: ArchivedCardViewProps) {
  const [selectedCell, setSelectedCell] = useState<ArchivedCell | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">{card.playerName}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-5 grid-rows-5 gap-2 md:gap-4">
          {card.cells.map((cell) => (
            cell.isJoker ? (
              <JokerCell key={cell.position} />
            ) : (
              <CellFace
                key={cell.position}
                cell={cell}
                editMode={false}
                isOwner={false}
                canInteract={!cell.isEmpty}
                sourceLabel={cell.sourceLabel}
                onClick={() => setSelectedCell(cell)}
              />
            )
          ))}
        </div>
      </CardContent>
      {selectedCell && (
        <ArchivedCellDialog cell={selectedCell} onClose={() => setSelectedCell(null)} />
      )}
    </Card>
  );
}
