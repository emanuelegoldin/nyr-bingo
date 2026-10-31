"use client";

/**
 * Team Detail Page
 * Spec Reference: 04-bingo-teams.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md
 *
 * The page is organised into three tabs:
 *   1. Cards   — bingo cards for every member (existing functionality)
 *   2. Members — simple member list with clickable avatars
 *   3. Leaderboard — ranked table of first-bingo times
 */

import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { TeamRefreshListener } from "@/components/team-refresh-listener";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/AppContext";
import { Crown, Loader2, Settings, Swords } from "lucide-react";
import { useState } from 'react';

import { BingoCardWithCells } from "@/lib/db/types";
import { TeamStatusBadge } from "@/components/team/team-status-badge";
import type { ResolutionFormData } from "@/lib/shared/types";
import { DeleteTeamDialog } from "./_components/DeleteTeamDialog";
import { InviteDialog } from "./_components/InviteDialog";
import { ProposeResolutionsDialog } from "./_components/ProposeResolutionsDialog";
import { TeamGoalDisplay } from "./_components/TeamGoalDisplay";
import { useTeamActions } from "./_components/use-team-actions";
import { CardsTab } from "./cards-tab";
import { LeaderboardTab, type LeaderboardEntry } from "./leaderboard-tab";
import { MembersTab } from "./members-tab";
import type { Team, TeamProvidedResolution } from "./types";

interface TeamDetailPageClientProps {
  teamId: string;
  initialTeam: Team;
  initialCards: BingoCardWithCells[];
  initialCurrentUserId: string;
  initialTeamGoal: ResolutionFormData | null;
  initialExistingResolutions: TeamProvidedResolution[];
  initialLeaderboardEntries: LeaderboardEntry[];
}

export default function TeamDetailPageClient({
  teamId,
  initialTeam,
  initialCards,
  initialCurrentUserId,
  initialTeamGoal,
  initialExistingResolutions,
  initialLeaderboardEntries,
}: TeamDetailPageClientProps) {
  usePageTitle("Team");

  const {
    team,
    teamGoal,
    existingResolutions,
    loadTeam,
    isStarting,
    handleStartBingo,
    deleteDialogOpen,
    setDeleteDialogOpen,
    isDeleting,
    handleDeleteTeam,
  } = useTeamActions({ teamId, initialTeam, initialTeamGoal, initialExistingResolutions });
  const [currentUserId] = useState<string>(initialCurrentUserId);

  // Team goal resolution dialog
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const isLeader = team.leaderUserId === currentUserId;
  const leader = team.members.find(m => m.membership.role === 'leader');

  /** Called when team goal is saved via the resolution dialog. */
  const handleGoalSaved = () => {
    setGoalDialogOpen(false);
    loadTeam();
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="font-headline text-3xl">{team.name}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Team Leader: {leader?.user.displayName || leader?.user.username || 'Unknown'}
            </CardDescription>
            <div className="mt-2">
              <TeamStatusBadge status={team.status} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isLeader && (
              <>
                <InviteDialog teamId={teamId} />

                <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" /> Set Goal
                </Button>

                {team.status !== 'started' && (
                  <Button onClick={handleStartBingo} disabled={isStarting}>
                    {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Swords className="h-4 w-4 mr-2" /> Start Bingo
                  </Button>
                )}
              </>
            )}

            {isLeader && (
              <DeleteTeamDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                onConfirm={handleDeleteTeam}
                isDeleting={isDeleting}
              />
            )}

            <ProposeResolutionsDialog
              teamId={teamId}
              team={team}
              currentUserId={currentUserId}
              existingResolutions={existingResolutions}
              onReload={loadTeam}
            />
          </div>
        </CardHeader>

        {/* ── Team Goal Display ─────────────────────────────────── */}
        <CardContent>
          <TeamGoalDisplay
            goal={teamGoal}
            isLeader={isLeader}
            onEdit={() => setGoalDialogOpen(true)}
          />
        </CardContent>
      </Card>

      {/* ── Team Goal Resolution Dialog ────────────────────────── */}
      <ResolutionCreateEditDialog
        key={teamGoal?.id ?? 'new-goal'}
        initialData={teamGoal ?? undefined}
        isOpen={goalDialogOpen}
        setIsOpen={setGoalDialogOpen}
        onSaved={handleGoalSaved}
        scope="team"
        teamId={teamId}
      />

      {/* ── Tab navigation ────────────────────────────────────── */}
      <TeamWsProvider teamId={teamId} teamName={team.name}>
        <TeamRefreshListener />
        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-6">
            <CardsTab
              team={team}
              initialCards={initialCards}
              currentUserId={currentUserId}
            />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <MembersTab team={team} currentUserId={currentUserId} />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <LeaderboardTab initialEntries={initialLeaderboardEntries} />
          </TabsContent>
        </Tabs>
      </TeamWsProvider>
    </div>
  );
}
