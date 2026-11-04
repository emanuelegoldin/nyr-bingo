import type { TeamMember } from "@/components/team/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, toastApiError } from "@/lib/api-client";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface NewGameDialogProps {
  teamId: string;
  /** The team members who can be selected as players. */
  members: TeamMember[];
  /** The creator, who always plays. */
  currentUserId: string;
}

/**
 * New Game button plus its dialog. The leader names the game and picks its players, all
 * selected by default; the creator always plays. On success it opens the new game's page,
 * where the leader sets the goal.
 * Spec Reference: 16-games.md - Game Creation
 *
 * @param props - The team, its members and the creator.
 * @returns The button and dialog.
 */
export function NewGameDialog({ teamId, members, currentUserId }: NewGameDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const allMemberIds = members.map((member) => member.user.userId);
  const [playerIds, setPlayerIds] = useState<string[]>(allMemberIds);

  /** Opens or closes the dialog; opening selects every member again. */
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setPlayerIds(allMemberIds);
    setOpen(nextOpen);
  };

  /** Adds or removes one member from the players. */
  const togglePlayer = (userId: string, checked: boolean) => {
    setPlayerIds((current) => (checked ? [...current, userId] : current.filter((id) => id !== userId)));
  };

  /** Creates the game and navigates to it. */
  const handleCreateGame = async () => {
    if (!name.trim()) return;

    setIsCreating(true);
    const result = await apiFetch<{ game: { id: string } }>(`/api/teams/${teamId}/games`, {
      method: "POST",
      json: { name, playerIds },
    });

    if (result.ok) {
      router.push(`/games/${result.data.game.id}`);
    } else {
      toastApiError(result, "Failed to create game");
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Game
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">New Game</DialogTitle>
          <DialogDescription>
            Start a new game with this team and choose who plays. No one needs to be invited again.
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Players</legend>
            <ul className="max-h-60 space-y-2 overflow-y-auto">
              {members.map((member) => {
                const userId = member.user.userId;
                const isCreator = userId === currentUserId;
                return (
                  <li key={userId} className="flex items-center gap-2">
                    <input
                      id={`player-${userId}`}
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={isCreator || playerIds.includes(userId)}
                      disabled={isCreator}
                      onChange={(event) => togglePlayer(userId, event.target.checked)}
                    />
                    <Label htmlFor={`player-${userId}`} className="font-normal">
                      {member.user.displayName || member.user.username}
                      {isCreator && <span className="text-muted-foreground ml-1">(You)</span>}
                    </Label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
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
