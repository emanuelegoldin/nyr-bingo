import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GamePermission } from "@/lib/authz/permissions";
import { Flag, LogOut, MoreHorizontal, Settings, SlidersHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Game } from "../types";
import { GameConfigDialog } from "./GameConfigDialog";

/** The dialog opened from the menu, or null when none is open. */
type GameActionDialog = "configure" | "end" | "delete" | "leave" | null;

interface GameActionsMenuProps {
  game: Game;
  /** Whether the caller holds a permission in the game (spec 21 - Client Gating). */
  can: (permission: GamePermission) => boolean;
  /** Opens the team goal dialog. */
  onSetGoal: () => void;
  /** Reloads the game after its configuration is saved. */
  onConfigured: () => void;
  onEndGame: () => void;
  isEnding: boolean;
  onDeleteGame: () => void;
  isDeleting: boolean;
  onLeaveGame: () => void;
  isLeaving: boolean;
}

/**
 * The More actions menu of the game header, with the dialogs its items open. It lists only
 * the actions the caller can use in the game's current state.
 * Spec Reference: 16-games.md - Game Page
 *
 * @param props - The game, the caller's permissions, and the actions with their pending flags.
 * @returns The menu button, its menu and the dialogs.
 */
export function GameActionsMenu({
  game,
  can,
  onSetGoal,
  onConfigured,
  onEndGame,
  isEnding,
  onDeleteGame,
  isDeleting,
  onLeaveGame,
  isLeaving,
}: GameActionsMenuProps) {
  const [openDialog, setOpenDialog] = useState<GameActionDialog>(null);

  /**
   * Builds the open-state handler of one dialog.
   *
   * @param dialog - The dialog the handler controls.
   * @returns A handler that opens that dialog or closes it.
   */
  const dialogOpenChange = (dialog: Exclude<GameActionDialog, null>) => (open: boolean) => {
    setOpenDialog(open ? dialog : null);
  };

  const canSetGoal = can('game.goal.set');
  const canConfigure = can('game.configure') && game.status === 'forming';
  const canEnd = can('game.end') && game.status === 'started';
  const canDelete = can('game.delete');

  return (
    <>
      {/* Not modal, so the page is usable again once a dialog opened from the menu closes */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="More actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canSetGoal && (
            <DropdownMenuItem onSelect={onSetGoal}>
              <Settings className="h-4 w-4 mr-2" /> Set Goal
            </DropdownMenuItem>
          )}
          {canConfigure && (
            <DropdownMenuItem onSelect={() => setOpenDialog('configure')}>
              <SlidersHorizontal className="h-4 w-4 mr-2" /> Configure
            </DropdownMenuItem>
          )}
          {canEnd && (
            <DropdownMenuItem onSelect={() => setOpenDialog('end')}>
              <Flag className="h-4 w-4 mr-2" /> End Game
            </DropdownMenuItem>
          )}
          {(canSetGoal || canConfigure || canEnd) && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={() => setOpenDialog('leave')}>
            <LogOut className="h-4 w-4 mr-2" /> Leave Game
          </DropdownMenuItem>
          {canDelete && (
            <DropdownMenuItem
              onSelect={() => setOpenDialog('delete')}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete Game
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {canConfigure && (
        <GameConfigDialog
          gameId={game.id}
          deadline={game.deadline}
          open={openDialog === 'configure'}
          onOpenChange={dialogOpenChange('configure')}
          onSaved={onConfigured}
        />
      )}

      {canEnd && (
        <ConfirmActionDialog
          open={openDialog === 'end'}
          onOpenChange={dialogOpenChange('end')}
          title="End this game?"
          description="The game finishes for everyone and moves to the archive. Open reviews close with the votes cast so far, and a review with no votes counts as accepted. This cannot be undone."
          confirmLabel="End Game"
          onConfirm={onEndGame}
          isPending={isEnding}
        />
      )}

      {canDelete && (
        <ConfirmActionDialog
          open={openDialog === 'delete'}
          onOpenChange={dialogOpenChange('delete')}
          title="Delete this game?"
          description="This will permanently delete the game, its team goal, its proposed resolutions, its bingo cards and related gameplay data. The team and its other games are not affected. This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={onDeleteGame}
          isPending={isDeleting}
        />
      )}

      <ConfirmActionDialog
        open={openDialog === 'leave'}
        onOpenChange={dialogOpenChange('leave')}
        title="Leave this game?"
        description="Your bingo card, your leaderboard entry and the resolutions written for you in this game will be deleted. The resolutions you wrote for other players stay on their cards. You cannot rejoin this game. If you are its only leader, promote another player on the team page first."
        confirmLabel="Leave Game"
        onConfirm={onLeaveGame}
        isPending={isLeaving}
      />
    </>
  );
}
