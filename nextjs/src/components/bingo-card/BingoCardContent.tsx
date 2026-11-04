import { apiFetch, toastApiError } from "@/lib/api-client";
import { BingoCardWithCells } from "@/lib/db/types";
import { useToast } from "@hooks/use-toast";
import { CardContent } from "@ui/card";
import { useCallback, useEffect, useState } from "react";
import { JokerCell } from "../cell/joker";
import { ResolutionCell } from "../cell/resolution-cell";
import { ConfettiLayer } from "./ConfettiLayer";

export function BingoCardContent(
  {
    initialCard,
    isOwner,
    editMode,
    gameId,
    currentUserId,
    cardUserId
  }
    :
    {
      initialCard: BingoCardWithCells,
      isOwner: boolean,
      editMode: boolean,
      gameId: string,
      currentUserId: string,
      cardUserId: string
    }
) {
  const { toast } = useToast();
  const [card, setCard] = useState<BingoCardWithCells>(initialCard);
  const fetchUrl = `/api/games/${gameId}/cards?userId=${cardUserId}`;

  const reloadCard = useCallback(async () => {
    const result = await apiFetch<{ card: BingoCardWithCells | null }>(fetchUrl);
    if (!result.ok) {
      toastApiError(result, 'Failed to refresh cards', 'Failed to refresh card');
      return;
    }
    if (!result.data.card) {
      // The player has no card in this game
      toast({ title: 'Error', description: 'Failed to refresh cards', variant: 'destructive' });
      return;
    }
    setCard(result.data.card);
  }, [fetchUrl, toast]);

  const handleCellUpdate = useCallback(
    async (cellId: string, newState: 'pending' | 'completed' | 'failed') => {
      const result =
        newState === 'pending'
          ? await apiFetch<unknown>(`/api/cells/${cellId}/undo-complete`, { method: 'POST' })
          : await apiFetch<unknown>(`/api/cells/${cellId}`, {
            method: 'PUT',
            json: { state: newState },
          });

      if (result.ok) {
        await reloadCard();
        return;
      }

      toastApiError(result, 'Failed to update cell');
      // The card may be stale, which is a common reason for the failure
      await reloadCard();
    },
    [reloadCard]
  );

  // Effects
  // A server refresh brings new props; every mutation signals one, so the last refresh
  // always carries the latest card.
  useEffect(() => {
    setCard(initialCard);
  }, [initialCard]);

  return (
    <CardContent className="px-3 sm:px-6">
      <ConfettiLayer cells={card.cells} />
      <div className="grid grid-cols-5 grid-rows-5 gap-1 sm:gap-2 md:gap-4">
        {card.cells.map((cell) => (
          cell.isJoker ?
            <JokerCell key={cell.id} />
            :
            <ResolutionCell
              key={cell.id}
              cell={cell}
              isOwner={isOwner}
              editMode={editMode}
              gameId={gameId}
              currentUserId={currentUserId}
              existingCells={card.cells}
              onUpdate={isOwner ? handleCellUpdate : undefined}
              onRefresh={reloadCard} />
        ))}
      </div>
    </CardContent>
  )
}