import { ActionsMenu, type ActionsMenuItem } from "@/components/actions-menu";
import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import type { GamePermission } from "@/lib/authz/permissions";
import { Flag, LogOut, Settings, SlidersHorizontal, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("Games.actionsMenu");
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
  const canConfigure = can('game.configure') && game.status !== 'ended';
  const canEnd = can('game.end') && game.status === 'started';
  const canDelete = can('game.delete');

  const stateActions: ActionsMenuItem[] = [
    ...(canSetGoal ? [{ key: 'goal', label: t("setGoal"), icon: Settings, onSelect: onSetGoal }] : []),
    ...(canConfigure
      ? [{ key: 'configure', label: t("configure"), icon: SlidersHorizontal, onSelect: () => setOpenDialog('configure') }]
      : []),
    ...(canEnd ? [{ key: 'end', label: t("endGame"), icon: Flag, onSelect: () => setOpenDialog('end') }] : []),
  ];
  const membershipActions: ActionsMenuItem[] = [
    { key: 'leave', label: t("leaveGame"), icon: LogOut, onSelect: () => setOpenDialog('leave') },
    ...(canDelete
      ? [{ key: 'delete', label: t("deleteGame"), icon: Trash2, onSelect: () => setOpenDialog('delete'), destructive: true }]
      : []),
  ];

  return (
    <>
      <ActionsMenu groups={[stateActions, membershipActions]} />

      {canConfigure && (
        <GameConfigDialog
          gameId={game.id}
          deadline={game.deadline}
          preparationDeadline={game.preparationDeadline}
          open={openDialog === 'configure'}
          onOpenChange={dialogOpenChange('configure')}
          onSaved={onConfigured}
        />
      )}

      {canEnd && (
        <ConfirmActionDialog
          open={openDialog === 'end'}
          onOpenChange={dialogOpenChange('end')}
          title={t("endDialog.title")}
          description={t("endDialog.description")}
          confirmLabel={t("endDialog.confirm")}
          onConfirm={onEndGame}
          isPending={isEnding}
        />
      )}

      {canDelete && (
        <ConfirmActionDialog
          open={openDialog === 'delete'}
          onOpenChange={dialogOpenChange('delete')}
          title={t("deleteDialog.title")}
          description={t("deleteDialog.description")}
          confirmLabel={t("deleteDialog.confirm")}
          onConfirm={onDeleteGame}
          isPending={isDeleting}
        />
      )}

      <ConfirmActionDialog
        open={openDialog === 'leave'}
        onOpenChange={dialogOpenChange('leave')}
        title={t("leaveDialog.title")}
        description={t("leaveDialog.description")}
        confirmLabel={t("leaveDialog.confirm")}
        onConfirm={onLeaveGame}
        isPending={isLeaving}
      />
    </>
  );
}
