import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TeamMember } from "@/components/team/types";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface InviteToGameDialogProps {
  gameId: string;
  teamId: string;
  /** The players of the game, who are not offered. */
  players: TeamMember[];
  /** Whether the dialog is open. */
  open: boolean;
  /** Called to open or close the dialog. */
  onOpenChange: (open: boolean) => void;
  /** Called after a member was invited, to reload the game. */
  onInvited: () => void;
}

/**
 * Invite to Game dialog, where an admin adds a team member who is not a player to the game.
 * It loads the team's members when it opens and lists those who do not play the game.
 * Spec Reference: 16-games.md - Inviting a Player
 *
 * @param props - The game, its team and players, the open state and the callback run after an invite.
 * @returns The dialog.
 */
export function InviteToGameDialog({ gameId, teamId, players, open, onOpenChange, onInvited }: InviteToGameDialogProps) {
  const t = useTranslations("Games.inviteDialog");
  const toastApiError = useApiErrorToast();
  const [teamMembers, setTeamMembers] = useState<TeamMember[] | null>(null);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);

  // Load the team's members each time the dialog opens, so the list is current.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setTeamMembers(null);
    apiFetch<{ team: { members: TeamMember[] } }>(`/api/teams/${teamId}`).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setTeamMembers(result.data.team.members);
      } else {
        setTeamMembers([]);
        toastApiError(result, t("loadFailed"));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, teamId, t, toastApiError]);

  const playerIds = new Set(players.map((player) => player.user.userId));
  const invitable = (teamMembers ?? []).filter((member) => !playerIds.has(member.user.userId));

  /**
   * Invites one team member to the game.
   *
   * @param userId - The member to invite.
   */
  const handleInvite = async (userId: string) => {
    setInvitingUserId(userId);
    const result = await apiFetch<unknown>(`/api/games/${gameId}/players`, { method: "POST", json: { userId } });
    setInvitingUserId(null);

    if (result.ok) {
      onInvited();
    } else {
      toastApiError(result, t("failed"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !invitingUserId && onOpenChange(nextOpen)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-headline">{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        {teamMembers === null ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : invitable.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">{t("nobody")}</p>
        ) : (
          <ul className="space-y-2 py-2">
            {invitable.map((member) => (
              <li key={member.user.userId} className="flex items-center justify-between gap-2">
                <span className="truncate">{member.user.displayName || member.user.username}</span>
                <Button
                  size="sm"
                  onClick={() => handleInvite(member.user.userId)}
                  disabled={invitingUserId !== null}
                >
                  {invitingUserId === member.user.userId && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("invite")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
