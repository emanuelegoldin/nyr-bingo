"use client";

/**
 * Game Page
 * Spec Reference: 16-games.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md
 *
 * The page is organised into three tabs:
 *   1. Cards   — bingo cards for every member (existing functionality)
 *   2. Members — simple member list with clickable avatars
 *   3. Leaderboard — ranked table of first-bingo times
 */

import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { GameStatusBadge } from "@/components/team/game-status-badge";
import { MembersTab } from "@/components/team/members-tab";
import { TeamRefreshListener } from "@/components/team-refresh-listener";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/AppContext";
import { CalendarClock, Crown, Flag, Loader2, LogOut, Settings, Swords, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from 'react';

import { BingoCardWithCells } from "@/lib/db/types";
import type { ResolutionFormData } from "@/lib/shared/types";
import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { formatLeaderNames } from "@/components/team/leaders";
import type { GamePermission } from "@/lib/authz/permissions";
import { GameConfigDialog } from "./_components/GameConfigDialog";
import { ProposeResolutionsDialog } from "./_components/ProposeResolutionsDialog";
import { TeamGoalDisplay } from "./_components/TeamGoalDisplay";
import { useLastLoaded } from "./_components/use-last-loaded";
import { useGameActions } from "./_components/use-game-actions";
import { CardsTab } from "./cards-tab";
import { LeaderboardTab, type LeaderboardEntry } from "./leaderboard-tab";
import type { Game, TeamProvidedResolution } from "./types";

interface GameDetailPageClientProps {
  initialGame: Game;
  /** Undefined when the server failed to read them, as for the other optional props. */
  initialCards?: BingoCardWithCells[];
  initialCurrentUserId: string;
  /** The caller's permissions in the game, computed on the server (spec 21 - Client Gating). */
  capabilities: GamePermission[];
  initialTeamGoal?: ResolutionFormData | null;
  initialExistingResolutions?: TeamProvidedResolution[];
  initialLeaderboardEntries?: LeaderboardEntry[];
}

export default function GameDetailPageClient({
  initialGame,
  initialCards,
  initialCurrentUserId,
  capabilities,
  initialTeamGoal,
  initialExistingResolutions,
  initialLeaderboardEntries,
}: GameDetailPageClientProps) {
  usePageTitle("Game");

  const cards = useLastLoaded<BingoCardWithCells[]>(initialCards, []);
  const leaderboardEntries = useLastLoaded<LeaderboardEntry[]>(initialLeaderboardEntries, []);

  const {
    game,
    teamGoal,
    existingResolutions,
    refreshGame,
    isStarting,
    handleStartBingo,
    isEnding,
    handleEndGame,
    isDeleting,
    handleDeleteGame,
    isLeaving,
    handleLeaveGame,
  } = useGameActions({ gameId: initialGame.id, initialGame, initialTeamGoal, initialExistingResolutions });

  // Team goal resolution dialog
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);

  const can = (permission: GamePermission): boolean => capabilities.includes(permission);

  /** Called when team goal is saved via the resolution dialog. */
  const handleGoalSaved = () => {
    setGoalDialogOpen(false);
    refreshGame();
  };

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="font-headline text-3xl">{game.name}</CardTitle>
            <CardDescription className="mt-2">
              <Link href={`/teams/${game.teamId}`} className="hover:underline">{game.teamName}</Link>
            </CardDescription>
            <CardDescription className="flex items-center gap-2 mt-2">
              <Crown className="h-4 w-4 text-amber-500" />
              Leaders: {formatLeaderNames(game.members)}
            </CardDescription>
            {game.deadline && (
              <CardDescription className="flex items-center gap-2 mt-2">
                <CalendarClock className="h-4 w-4" />
                Last day: {game.deadline}
              </CardDescription>
            )}
            <div className="mt-2">
              <GameStatusBadge status={game.status} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {can('game.goal.set') && (
              <Button variant="outline" size="sm" onClick={() => setGoalDialogOpen(true)}>
                <Settings className="h-4 w-4 mr-2" /> Set Goal
              </Button>
            )}

            {can('game.configure') && game.status === 'forming' && (
              <GameConfigDialog gameId={game.id} deadline={game.deadline} onSaved={refreshGame} />
            )}

            {can('game.start') && game.status !== 'started' && (
              <Button onClick={handleStartBingo} disabled={isStarting}>
                {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Swords className="h-4 w-4 mr-2" /> Start Bingo
              </Button>
            )}

            {can('game.end') && game.status === 'started' && (
              <ConfirmActionDialog
                triggerLabel="End Game"
                triggerIcon={Flag}
                triggerVariant="outline"
                title="End this game?"
                description="The game finishes for everyone and moves to the archive. Open reviews close with the votes cast so far, and a review with no votes counts as accepted. This cannot be undone."
                confirmLabel="End Game"
                onConfirm={handleEndGame}
                isPending={isEnding}
              />
            )}

            {can('game.delete') && (
              <ConfirmActionDialog
                triggerLabel="Delete Game"
                triggerIcon={Trash2}
                triggerVariant="destructive"
                title="Delete this game?"
                description="This will permanently delete the game, its team goal, its proposed resolutions, its bingo cards and related gameplay data. The team and its other games are not affected. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={handleDeleteGame}
                isPending={isDeleting}
              />
            )}

            <ProposeResolutionsDialog
              game={game}
              currentUserId={initialCurrentUserId}
              existingResolutions={existingResolutions}
              onReload={refreshGame}
            />

            <ConfirmActionDialog
              triggerLabel="Leave Game"
              triggerIcon={LogOut}
              triggerVariant="outline"
              title="Leave this game?"
              description="Your bingo card, your leaderboard entry and the resolutions written for you in this game will be deleted. The resolutions you wrote for other players stay on their cards. You cannot rejoin this game. If you are its only leader, promote another player on the team page first."
              confirmLabel="Leave Game"
              onConfirm={handleLeaveGame}
              isPending={isLeaving}
            />
          </div>
        </CardHeader>

        {/* ── Team Goal Display ─────────────────────────────────── */}
        <CardContent>
          <TeamGoalDisplay
            goal={teamGoal}
            isLeader={can('game.goal.set')}
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
        gameId={game.id}
      />

      {/* ── Tab navigation ────────────────────────────────────── */}
      <TeamWsProvider teamId={game.teamId}>
        <TeamRefreshListener />
        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards">Cards</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-6">
            <CardsTab
              game={game}
              initialCards={cards}
              currentUserId={initialCurrentUserId}
            />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <MembersTab members={game.members} currentUserId={initialCurrentUserId} />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <LeaderboardTab initialEntries={leaderboardEntries} />
          </TabsContent>
        </Tabs>
      </TeamWsProvider>
    </div>
  );
}
