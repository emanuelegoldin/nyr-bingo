import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * The earliest last day the picker offers: today, or the date the preparation ends if that is later (spec 16).
 * @param preparationDeadline End of the preparation phase, ISO 8601 in UTC, or null
 * @returns YYYY-MM-DD
 */
const earliestDeadline = (preparationDeadline: string | null): string => {
  const today = new Date().toISOString().slice(0, 10);
  const preparationDate = preparationDeadline?.slice(0, 10) ?? today;
  return preparationDate > today ? preparationDate : today;
};

interface GameConfigDialogProps {
  gameId: string;
  /** The saved deadline as YYYY-MM-DD, or null when there is none. */
  deadline: string | null;
  /** End of the preparation phase, ISO 8601 in UTC; the deadline cannot fall before its date. */
  preparationDeadline: string | null;
  /** Whether the dialog is open. */
  open: boolean;
  /** Called to open or close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Called after the configuration is saved. */
  onSaved: () => void;
}

/**
 * Configure dialog, where the leader sets, changes or removes the deadline of a running game.
 * The caller opens it, from the game's More actions menu.
 * Spec Reference: 16-games.md - Game Configuration, Game Page
 *
 * @param props - The game, its saved deadline, the open state and the callback run after saving.
 * @returns The dialog.
 */
export function GameConfigDialog({
  gameId,
  deadline,
  preparationDeadline,
  open,
  onOpenChange,
  onSaved,
}: GameConfigDialogProps) {
  const t = useTranslations("Games.configDialog");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  // An empty value means no deadline
  const [selectedDate, setSelectedDate] = useState(deadline ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Start from the saved deadline each time the dialog opens
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelectedDate(deadline ?? "");
  }

  /** Closes the dialog unless the configuration is being saved. */
  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) return;
    onOpenChange(nextOpen);
  };

  /** Saves the selected deadline, or removes it when none is selected. */
  const handleSave = async () => {
    setIsSaving(true);
    const result = await apiFetch<unknown>(`/api/games/${gameId}`, {
      method: "PATCH",
      json: { deadline: selectedDate || null },
    });
    setIsSaving(false);

    if (result.ok) {
      onOpenChange(false);
      onSaved();
    } else {
      toastApiError(result, t("failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="gameDeadline">{t("lastDay")}</Label>
          <div className="flex gap-2">
            <Input
              id="gameDeadline"
              type="date"
              min={earliestDeadline(preparationDeadline)}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <Button variant="outline" onClick={() => setSelectedDate("")} disabled={!selectedDate}>
              {t("clear")}
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
