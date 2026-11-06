import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import { REACTABLE_CELL_STATES } from "@/lib/shared/reactions";
import type { BingoCardWithCells, BingoCell } from "@/lib/db/types";
import { useToast } from "@hooks/use-toast";
import { CardContent } from "@ui/card";
import { useTranslations } from "next-intl";
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { JokerCell } from "../cell/joker";
import { ResolutionCell } from "../cell/resolution-cell";
import { CardGrid } from "./card-grid";
import { ConfettiLayer } from "./ConfettiLayer";

export function BingoCardContent(
  {
    card,
    setCard,
    isOwner,
    editMode,
    gameId,
    currentUserId,
    cardUserId
  }
    :
    {
      card: BingoCardWithCells,
      setCard: Dispatch<SetStateAction<BingoCardWithCells>>,
      isOwner: boolean,
      editMode: boolean,
      gameId: string,
      currentUserId: string,
      cardUserId: string
    }
) {
  const { toast } = useToast();
  const t = useTranslations("Dashboard");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  const fetchUrl = `/api/games/${gameId}/cards?userId=${cardUserId}`;

  const reloadCard = useCallback(async () => {
    const result = await apiFetch<{ card: BingoCardWithCells | null }>(fetchUrl);
    if (!result.ok) {
      toastApiError(result, t('refreshCardFailed'));
      return;
    }
    if (!result.data.card) {
      // The player has no card in this game
      toast({ title: tc('error'), description: t('refreshFailed'), variant: 'destructive' });
      return;
    }
    setCard(result.data.card);
  }, [fetchUrl, setCard, toast, t, tc, toastApiError]);

  const handleCellUpdate = useCallback(
    async (cellId: string, newState: 'pending' | 'completed' | 'failed') => {
      const result =
        newState === 'pending'
          ? await apiFetch<{ cell: BingoCell }>(`/api/cells/${cellId}/undo-complete`, { method: 'POST' })
          : await apiFetch<{ cell: BingoCell }>(`/api/cells/${cellId}`, {
            method: 'PUT',
            json: { state: newState },
          });

      if (result.ok) {
        // Patch the returned cell; the refresh signalled over WebSocket brings the rest.
        // These actions never open or close a review thread, so it is kept.
        const updated = result.data.cell;
        setCard((current) => ({
          ...current,
          cells: current.cells.map((cell) => (cell.id === updated.id
            // Spec 24 - Losing Reactions: a cell that is no longer stamped has none
            ? { ...cell, ...updated, reactions: REACTABLE_CELL_STATES.includes(updated.state) ? cell.reactions : [] }
            : cell)),
        }));
        return;
      }

      toastApiError(result, t('updateCellFailed'));
      // The card may be stale, which is a common reason for the failure
      await reloadCard();
    },
    [reloadCard, setCard, t, toastApiError]
  );

  return (
    <CardContent className="px-3 sm:px-6">
      <ConfettiLayer cells={card.cells} gridSize={card.gridSize} />
      <CardGrid gridSize={card.gridSize}>
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
      </CardGrid>
    </CardContent>
  )
}