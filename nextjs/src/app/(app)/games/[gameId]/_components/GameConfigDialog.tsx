import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

interface GameConfigDialogProps {
  gameId: string;
  /** The saved deadline as YYYY-MM-DD, or null when there is none. */
  deadline: string | null;
  /** Called after the configuration is saved. */
  onSaved: () => void;
}

/**
 * Configure button plus its dialog, where the leader sets or removes the game's deadline
 * before starting it.
 * Spec Reference: 16-games.md - Game Configuration
 *
 * @param props - The game, its saved deadline and the callback run after saving.
 * @returns The button and dialog.
 */
export function GameConfigDialog({ gameId, deadline, onSaved }: GameConfigDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  // An empty value means no deadline
  const [selectedDate, setSelectedDate] = useState(deadline ?? "");
  const [isSaving, setIsSaving] = useState(false);

  /** Opens or closes the dialog, starting from the saved deadline each time. */
  const handleOpenChange = (nextOpen: boolean) => {
    if (isSaving) return;
    if (nextOpen) setSelectedDate(deadline ?? "");
    setOpen(nextOpen);
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
      setOpen(false);
      onSaved();
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to configure game",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="h-4 w-4 mr-2" /> Configure
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">Configure Game</DialogTitle>
          <DialogDescription>
            The game ends automatically after its last day. Without a date, it ends only when you
            end it. You cannot change this after the game starts.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="gameDeadline">Last day (optional)</Label>
          <div className="flex gap-2">
            <Input
              id="gameDeadline"
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
            <Button variant="outline" onClick={() => setSelectedDate("")} disabled={!selectedDate}>
              Clear
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
