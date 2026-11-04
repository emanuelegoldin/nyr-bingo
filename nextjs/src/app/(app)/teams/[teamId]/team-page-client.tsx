"use client";

/**
 * Team Page
 * Spec Reference: 04-bingo-teams.md - Team Page
 *
 * A team is a list of users with one or more leaders: the page shows the running games the
 * user plays, its members and the leaders' actions.
 */

import { GameList, type GameListItem } from "@/components/team/game-list";
import { formatLeaderNames } from "@/components/team/leaders";
import type { TeamPermission } from "@/lib/authz/permissions";
import { MembersTab } from "@/components/team/members-tab";
import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import type { Team } from "@/components/team/types";
import { TeamRefreshListener } from "@/components/team-refresh-listener";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, toastApiError } from "@/lib/api-client";
import { Crown, LogOut, Trash2 } from "lucide-react";
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
  usePageTitle("Team");

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
        title: "Team deleted",
        description: "The team and its related data were removed.",
      });
      router.push("/teams");
      router.refresh();
    } else {
      toastApiError(result, "Failed to delete team");
    }
    setIsDeleting(false);
  };

  /** Leaves the team and its games; on success navigates back to the teams list. */
  const handleLeaveTeam = async () => {
    setIsLeaving(true);
    const result = await apiFetch<unknown>(`/api/teams/${team.id}/leave`, { method: "POST" });

    if (result.ok) {
      toast({ title: "You left the team" });
      router.push("/teams");
      router.refresh();
    } else {
      toastApiError(result, "Failed to leave team");
    }
    setIsLeaving(false);
  };

  /** Makes a member a leader, then reloads the page data. */
  const handlePromote = async (userId: string) => {
    setPromotingUserId(userId);
    const result = await apiFetch<unknown>(`/api/teams/${team.id}/leaders`, { method: "POST", json: { userId } });

    if (result.ok) {
      toast({ title: "Member promoted to leader" });
      router.refresh();
    } else {
      toastApiError(result, "Failed to promote member");
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
                Team Leaders: {formatLeaderNames(team.members)}
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canCreateGame && (
                <NewGameDialog teamId={team.id} members={team.members} currentUserId={currentUserId} />
              )}
              {capabilities.includes('team.invite') && <InviteDialog teamId={team.id} />}
              {capabilities.includes('team.delete') && (
                <ConfirmActionDialog
                  triggerLabel="Delete Team"
                  triggerIcon={Trash2}
                  triggerVariant="destructive"
                  title="Delete this team?"
                  description="This will permanently delete the team, its memberships, invitations and all of its games, with their resolutions, bingo cards and related gameplay data. Archived games are kept. This action cannot be undone."
                  confirmLabel="Delete"
                  onConfirm={handleDeleteTeam}
                  isPending={isDeleting}
                />
              )}
              <ConfirmActionDialog
                triggerLabel="Leave Team"
                triggerIcon={LogOut}
                triggerVariant="outline"
                title="Leave this team?"
                description="You will also leave every running game of this team that you play: your bingo cards, leaderboard entries and the resolutions written for you are deleted. The resolutions you wrote for others stay on their cards. You can only come back with a new invitation. If you are the only leader, promote another member first."
                confirmLabel="Leave Team"
                onConfirm={handleLeaveTeam}
                isPending={isLeaving}
              />
            </div>
          </CardHeader>
        </Card>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold font-headline">Games</h2>
          {games.length > 0 ? (
            <GameList games={games} />
          ) : (
            <p className="text-muted-foreground">
              {canCreateGame ? 'No games yet. Click "New Game" to create one.' : "No games yet."}
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
