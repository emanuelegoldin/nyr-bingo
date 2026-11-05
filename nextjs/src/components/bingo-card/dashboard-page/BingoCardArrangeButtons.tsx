import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import type { BingoCardWithCells } from "@/lib/db/types";
import { DONE_CELL_STATES } from "@/lib/shared/types";
import { Button } from "@ui/button";
import { Loader2, Lock, Shuffle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useContext, useState } from "react";
import { BingoCardContext } from "../BingoCardProvider";

/**
 * Shuffle and Lock buttons of the owner's dashboard card. Both are hidden once the card is
 * locked and while the card is in edit mode; Shuffle is disabled while a cell is done.
 * Spec Reference: 22-card-shuffle.md - Dashboard UI
 *
 * @returns The buttons, or nothing when the card cannot be rearranged.
 */
export function BingoCardArrangeButtons() {
  const t = useTranslations("Dashboard");
  const toastApiError = useApiErrorToast();
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
      toastApiError(result, action === "shuffle" ? t("shuffleFailed") : t("lockFailed"));
      return;
    }
    const updatedCard = result.data.card;
    if (updatedCard) setCard(updatedCard);
  };

  return (
    <>
      <span title={hasDoneCell ? t("shuffleBlockedHint") : undefined}>
        <Button
          variant="outline"
          size="sm"
          disabled={hasDoneCell || pendingAction !== null}
          onClick={() => arrangeCard("shuffle")}
        >
          {pendingAction === "shuffle"
            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            : <Shuffle className="h-4 w-4 mr-2" />}
          {t("shuffle")}
        </Button>
      </span>
      <ConfirmActionDialog
        triggerLabel={t("lock")}
        triggerIcon={Lock}
        triggerVariant="outline"
        title={t("lockTitle")}
        description={t("lockDescription")}
        confirmLabel={t("lock")}
        onConfirm={() => arrangeCard("lock")}
        isPending={pendingAction === "lock"}
      />
    </>
  );
}
