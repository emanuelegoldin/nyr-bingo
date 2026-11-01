"use client";

/**
 * Team Page
 * Spec Reference: 04-bingo-teams.md - Team Page
 *
 * A team is a list of users with a leader: the page shows its running games, its members
 * and the leader's actions.
 */

import { GameList, type GameListItem } from "@/components/team/game-list";
import { MembersTab } from "@/components/team/members-tab";
import type { Team } from "@/components/team/types";
import { TeamRefreshListener } from "@/components/team-refresh-listener";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePageTitle } from "@/hooks/AppContext";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteTeamDialog } from "./_components/DeleteTeamDialog";
import { InviteDialog } from "./_components/InviteDialog";
import { NewGameDialog } from "./_components/NewGameDialog";

interface TeamPageClientProps {
  team: Team;
  games: GameListItem[];
  currentUserId: string;
}

export default function TeamPageClient({ team, games, currentUserId }: TeamPageClientProps) {
  usePageTitle("Team");

  const { toast } = useToast();
  const router = useRouter();
  // Open state lives here because a successful delete closes the dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isLeader = team.leaderUserId === currentUserId;
  const leader = team.members.find((member) => member.membership.role === "leader");

  /** Deletes the team; on success navigates back to the teams list. */
  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    const result = await apiFetch<unknown>(`/api/teams/${team.id}`, { method: "DELETE" });

    if (result.ok) {
      setDeleteDialogOpen(false);
      toast({
        title: "Team deleted",
        description: "The team and its related data were removed.",
      });
      router.push("/teams");
      router.refresh();
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to delete team",
        variant: "destructive",
      });
    }
    setIsDeleting(false);
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
                Team Leader: {leader?.user.displayName || leader?.user.username || "Unknown"}
              </CardDescription>
            </div>
            {isLeader && (
              <div className="flex gap-2 flex-wrap">
                <NewGameDialog teamId={team.id} />
                <InviteDialog teamId={team.id} />
                <DeleteTeamDialog
                  open={deleteDialogOpen}
                  onOpenChange={setDeleteDialogOpen}
                  onConfirm={handleDeleteTeam}
                  isDeleting={isDeleting}
                />
              </div>
            )}
          </CardHeader>
        </Card>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold font-headline">Games</h2>
          {games.length > 0 ? (
            <GameList games={games} />
          ) : (
            <p className="text-muted-foreground">
              {isLeader ? 'No games yet. Click "New Game" to create one.' : "No games yet."}
            </p>
          )}
        </section>

        <MembersTab members={team.members} currentUserId={currentUserId} />
      </div>
    </TeamWsProvider>
  );
}
