/**
 * More actions menu of the team header, with the confirmations its items open.
 * Spec Reference: 04-bingo-teams.md - Team Page
 */

import { ActionsMenu, type ActionsMenuItem } from "@/components/actions-menu";
import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { LogOut, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** The confirmation opened from the menu, or null when none is open. */
type TeamActionDialog = "leave" | "delete" | null;

interface TeamActionsMenuProps {
  /** Whether the caller can delete the team (spec 21 - Client Gating). */
  canDelete: boolean;
  onLeaveTeam: () => void;
  isLeaving: boolean;
  onDeleteTeam: () => void;
  isDeleting: boolean;
}

/**
 * Renders the More actions menu of the team page with Leave Team and, for leaders, Delete Team.
 *
 * @param props - Whether the caller can delete the team, and the actions with their pending flags.
 * @returns The menu button, its menu and the confirmations.
 */
export function TeamActionsMenu({ canDelete, onLeaveTeam, isLeaving, onDeleteTeam, isDeleting }: TeamActionsMenuProps) {
  const t = useTranslations("Teams");
  const tc = useTranslations("Common");
  const [openDialog, setOpenDialog] = useState<TeamActionDialog>(null);

  /**
   * Builds the open-state handler of one confirmation.
   *
   * @param dialog - The confirmation the handler controls.
   * @returns A handler that opens that confirmation or closes it.
   */
  const dialogOpenChange = (dialog: Exclude<TeamActionDialog, null>) => (open: boolean) => {
    setOpenDialog(open ? dialog : null);
  };

  const items: ActionsMenuItem[] = [
    { key: 'leave', label: t("detail.leaveTrigger"), icon: LogOut, onSelect: () => setOpenDialog('leave') },
    ...(canDelete
      ? [{ key: 'delete', label: t("detail.deleteTrigger"), icon: Trash2, onSelect: () => setOpenDialog('delete'), destructive: true }]
      : []),
  ];

  return (
    <>
      <ActionsMenu groups={[items]} />

      <ConfirmActionDialog
        open={openDialog === 'leave'}
        onOpenChange={dialogOpenChange('leave')}
        title={t("detail.leaveTitle")}
        description={t("detail.leaveDescription")}
        confirmLabel={t("detail.leaveTrigger")}
        onConfirm={onLeaveTeam}
        isPending={isLeaving}
      />

      {canDelete && (
        <ConfirmActionDialog
          open={openDialog === 'delete'}
          onOpenChange={dialogOpenChange('delete')}
          title={t("detail.deleteTitle")}
          description={t("detail.deleteDescription")}
          confirmLabel={tc("delete")}
          onConfirm={onDeleteTeam}
          isPending={isDeleting}
        />
      )}
    </>
  );
}
