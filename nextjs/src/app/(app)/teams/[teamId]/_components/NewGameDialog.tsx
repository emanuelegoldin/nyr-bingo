import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface NewGameDialogProps {
  teamId: string;
}

/**
 * New Game button plus its dialog. On success it opens the new game's page, where the
 * leader sets the goal.
 * Spec Reference: 16-games.md - Game Creation
 *
 * @param props - The team the game is created for.
 * @returns The button and dialog.
 */
export function NewGameDialog({ teamId }: NewGameDialogProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  /** Creates the game and navigates to it. */
  const handleCreateGame = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    const result = await apiFetch<{ game: { id: string } }>(`/api/teams/${teamId}/games`, {
      method: "POST",
      json: { name },
    });

    if (result.ok) {
      router.push(`/games/${result.data.game.id}`);
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to create game",
        variant: "destructive",
      });
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Game
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">New Game</DialogTitle>
          <DialogDescription>
            Start a new game with this team. No one needs to be invited again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="gameName">Game Name</Label>
            <Input
              id="gameName"
              placeholder="e.g., Resolutions 2027"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !isCreating && handleCreateGame()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreateGame} disabled={isCreating || !name.trim()}>
            {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
