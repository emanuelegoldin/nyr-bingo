import { apiFetch } from "@/lib/api-client";
import { BingoCardWithCells } from "@/lib/db/types";
import { useToast } from "@hooks/use-toast";
import { CardContent } from "@ui/card";
import { useCallback, useContext, useEffect, useState } from "react";
import { JokerCell } from "../cell/joker";
import { ResolutionCell } from "../cell/resolution-cell";
import { BingoCardContext } from "./BingoCardProvider";
import { ConfettiLayer } from "./ConfettiLayer";

export function BingoCardContent(
  {
    initialCard,
    isOwner,
    editMode,
    teamId,
    currentUserId,
    fetchInput
  }
    :
    {
      initialCard: BingoCardWithCells,
      isOwner: boolean,
      editMode: boolean,
      teamId: string,
      currentUserId: string,
      fetchInput?: string | URL | Request
    }
) {
  // Hooks
  const context = useContext(BingoCardContext);
  if (!context) {
    throw new Error("BingoCardContent must be used within a BingoCardProvider");
  }

  const { toast } = useToast();
  const [card, setCard] = useState<BingoCardWithCells>(initialCard);
  // Allow parent to pass a fetchInput to narrow down the cards to load (e.g., from dashboard page --> we are interested only in current user cards)
  const fetchUrl = fetchInput ? fetchInput : `/api/teams/${teamId}/cards?userId=${currentUserId}`;

  const reloadCard = useCallback(async () => {
    try {
      const response = await fetch(fetchUrl);
      const data = await response.json();

      if (!response.ok || !data.card) {
        toast({
          title: 'Error',
          description: data.error || 'Failed to refresh cards',
          variant: 'destructive',
        });
        return;
      }

      setCard(data.card);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to refresh card',
        variant: 'destructive',
      });
    }
  }, [currentUserId, teamId, toast, fetchUrl]);

  const handleCellUpdate = useCallback(
    async (cellId: string, newState: 'pending' | 'completed') => {
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

      toast({
        title: 'Error',
        description: result.status === 0 ? 'An error occurred' : result.error || 'Failed to update cell',
        variant: 'destructive',
      });
      // The card may be stale, which is a common reason for the failure
      await reloadCard();
    },
    [reloadCard, toast]
  );

  // Effects
  // A server refresh brings new props; every mutation signals one, so the last refresh
  // always carries the latest card.
  useEffect(() => {
    setCard(initialCard);
  }, [initialCard]);

  return (
    <CardContent>
      <ConfettiLayer cells={card.cells} />
      <div className="grid grid-cols-5 grid-rows-5 gap-2 md:gap-4">
        {card.cells.map((cell) => (
          cell.isJoker ?
            <JokerCell key={cell.id} />
            :
            <ResolutionCell
              key={cell.id}
              cell={cell}
              isOwner={isOwner}
              editMode={editMode}
              teamId={teamId ? teamId : ""}
              currentUserId={currentUserId ? currentUserId : ""}
              existingCells={card.cells}
              onUpdate={isOwner ? handleCellUpdate : undefined}
              onRefresh={reloadCard} />
        ))}
      </div>
    </CardContent>
  )
}