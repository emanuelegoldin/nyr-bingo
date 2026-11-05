"use client";

/**
 * Team Page
 * Spec Reference: 04-bingo-teams.md - Team Page
 *
 * A team is a list of users with one or more leaders: the page shows the running games the
 * user plays, its members and the leaders' actions.
 */

import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { TeamRefreshListener } from "@/components/team-refresh-listener";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { GameList, type GameListItem } from "@/components/team/game-list";
import { formatLeaderNames } from "@/components/team/leaders";
import { MembersTab } from "@/components/team/members-tab";
import type { Team } from "@/components/team/types";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { apiFetch } from "@/lib/api-client";
import type { TeamPermission } from "@/lib/authz/permissions";
import { Crown, LogOut, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InviteDialog } from "./_components/InviteDialog";
import { NewGameDialog } from "./_components/NewGameDialog";

interface TeamPageClientProps {
  team: Team;
  games: GameListItem[];
  currentUserId: string;
  /** The caller's permissions in the team, computed on the server (spec 21 - Client Gating). */
  capabilities: TeamPermission[];
}

export default function TeamPageClient({ team, games, currentUserId, capabilities }: TeamPageClientProps) {
  const t = useTranslations("Teams");
  const tc = useTranslations("Common");
  const toastApiError = useApiErrorToast();
  usePageTitle(t("detail.pageTitle"));

  const { toast } = useToast();
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);

  const canCreateGame = capabilities.includes('game.create');

  /** Deletes the team; on success navigates back to the teams list. */
  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    const result = await apiFetch<unknown>(`/api/teams/${team.id}`, { method: "DELETE" });

    if (result.ok) {
      toast({
        title: t("detail.deletedTitle"),
        description: t("detail.deletedDescription"),
      });
      router.push("/teams");
      router.refresh();
    } else {
      toastApiError(result, t("detail.deleteFailed"));
    }
    setIsDeleting(false);
  };

  /** Leaves the team and its games; on success navigates back to the teams list. */
  const handleLeaveTeam = async () => {
    setIsLeaving(true);
    const result = await apiFetch<unknown>(`/api/teams/${team.id}/leave`, { method: "POST" });

    if (result.ok) {
      toast({ title: t("detail.leftTitle") });
      router.push("/teams");
      router.refresh();
    } else {
      toastApiError(result, t("detail.leaveFailed"));
    }
    setIsLeaving(false);
  };

  /** Makes a member a leader, then reloads the page data. */
  const handlePromote = async (userId: string) => {
    setPromotingUserId(userId);
    const result = await apiFetch<unknown>(`/api/teams/${team.id}/leaders`, { method: "POST", json: { userId } });

    if (result.ok) {
      toast({ title: t("detail.promotedTitle") });
      router.refresh();
    } else {
      toastApiError(result, t("detail.promoteFailed"));
    }
    setPromotingUserId(null);
  };

  return (
    <TeamWsProvider teamId={team.id}>
      <TeamRefreshListener />
      <div className="space-y-8">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="font-headline text-3xl">{team.name}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-2">
                <Crown className="h-4 w-4 text-amber-500" />
                {t("detail.leaders", { names: formatLeaderNames(team.members, t("leaders.unknown")) })}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canCreateGame && (
                <NewGameDialog teamId={team.id} members={team.members} currentUserId={currentUserId} />
              )}
              {capabilities.includes('team.invite') && <InviteDialog teamId={team.id} />}
              {capabilities.includes('team.delete') && (
                <ConfirmActionDialog
                  triggerLabel={t("detail.deleteTrigger")}
                  triggerIcon={Trash2}
                  triggerVariant="destructive"
                  title={t("detail.deleteTitle")}
                  description={t("detail.deleteDescription")}
                  confirmLabel={tc("delete")}
                  onConfirm={handleDeleteTeam}
                  isPending={isDeleting}
                />
              )}
              <ConfirmActionDialog
                triggerLabel={t("detail.leaveTrigger")}
                triggerIcon={LogOut}
                triggerVariant="outline"
                title={t("detail.leaveTitle")}
                description={t("detail.leaveDescription")}
                confirmLabel={t("detail.leaveTrigger")}
                onConfirm={handleLeaveTeam}
                isPending={isLeaving}
              />
            </div>
          </CardHeader>
        </Card>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold font-headline">{t("detail.gamesHeading")}</h2>
          {games.length > 0 ? (
            <GameList games={games} />
          ) : (
            <p className="text-muted-foreground">
              {canCreateGame ? t("detail.noGamesCanCreate") : t("detail.noGames")}
            </p>
          )}
        </section>

        <MembersTab
          members={team.members}
          currentUserId={currentUserId}
          canPromote={capabilities.includes('team.promote')}
          onPromote={handlePromote}
          promotingUserId={promotingUserId}
        />
      </div>
    </TeamWsProvider>
  );
}
