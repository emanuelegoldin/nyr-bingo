import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { apiFetch, toastApiError } from "@/lib/api-client";
import type { BingoCardWithCells } from "@/lib/db/types";
import { DONE_CELL_STATES } from "@/lib/shared/types";
import { Button } from "@ui/button";
import { Loader2, Lock, Shuffle } from "lucide-react";
import { useContext, useState } from "react";
import { BingoCardContext } from "../BingoCardProvider";

const SHUFFLE_BLOCKED_HINT = "A card with completed cells can no longer be shuffled";

/**
 * Shuffle and Lock buttons of the owner's dashboard card. Both are hidden once the card is
 * locked and while the card is in edit mode; Shuffle is disabled while a cell is done.
 * Spec Reference: 22-card-shuffle.md - Dashboard UI
 *
 * @returns The buttons, or nothing when the card cannot be rearranged.
 */
export function BingoCardArrangeButtons() {
  const { card, setCard, gameId, isEditMode } = useContext(BingoCardContext);
  const [pendingAction, setPendingAction] = useState<"shuffle" | "lock" | null>(null);

  if (!card || card.lockedAt || isEditMode) return null;

  const hasDoneCell = card.cells.some((cell) => DONE_CELL_STATES.includes(cell.state));

  /**
   * Run a shuffle or lock on the server and show the card it returns.
   * @param action The change to make
   */
  const arrangeCard = async (action: "shuffle" | "lock") => {
    setPendingAction(action);
    const result = await apiFetch<{ card: BingoCardWithCells | null }>(
      `/api/games/${gameId}/card/${action}`,
      { method: "POST" }
    );
    setPendingAction(null);

    if (!result.ok) {
      toastApiError(result, action === "shuffle" ? "Failed to shuffle card" : "Failed to lock card");
      return;
    }
    const updatedCard = result.data.card;
    if (updatedCard) setCard(updatedCard);
  };

  return (
    <>
      <span title={hasDoneCell ? SHUFFLE_BLOCKED_HINT : undefined}>
        <Button
          variant="outline"
          size="sm"
          disabled={hasDoneCell || pendingAction !== null}
          onClick={() => arrangeCard("shuffle")}
        >
          {pendingAction === "shuffle"
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <Shuffle className="h-4 w-4 mr-2" />}
          Shuffle
        </Button>
      </span>
      <ConfirmActionDialog
        triggerLabel="Lock"
        triggerIcon={Lock}
        triggerVariant="outline"
        title="Lock this card?"
        description="Once locked, the card keeps its current layout and can no longer be shuffled. This cannot be undone."
        confirmLabel="Lock"
        onConfirm={() => arrangeCard("lock")}
        isPending={pendingAction === "lock"}
      />
    </>
  );
}
