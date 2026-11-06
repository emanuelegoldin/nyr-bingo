"use client";

/**
 * Game Page
 * Spec Reference: 16-games.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md
 *
 * The page is organised into two tabs:
 *   1. Cards   — bingo cards for every member (existing functionality)
 *   2. Leaderboard — ranked table of first-bingo times
 */

import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { TeamRefreshListener } from "@/components/team-refresh-listener";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { GameStatusBadge } from "@/components/team/game-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/AppContext";
import { CalendarClock, Loader2, Swords } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from 'react';

import type { GamePermission } from "@/lib/authz/permissions";
import { BingoCardWithCells } from "@/lib/db/types";
import type { LeaderboardEntry, ResolutionFormData } from "@/lib/shared/types";
import { GameActionsMenu } from "./_components/GameActionsMenu";
import { ProposeResolutionsDialog } from "./_components/ProposeResolutionsDialog";
import { TeamGoalDisplay } from "./_components/TeamGoalDisplay";
import { useGameActions } from "./_components/use-game-actions";
import { useLastLoaded } from "./_components/use-last-loaded";
import { CardsTab } from "./cards-tab";
import { LeaderboardTab } from "./leaderboard-tab";
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
  const t = useTranslations("Games.detail");
  usePageTitle(t("pageTitle"));

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
              {game.teamName}
            </CardDescription>
            {game.deadline && (
              <CardDescription className="flex items-center gap-2 mt-2">
                <CalendarClock className="h-4 w-4" />
                {t("lastDay", { date: game.deadline })}
              </CardDescription>
            )}
            <div className="mt-2">
              <GameStatusBadge status={game.status} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {can('game.start') && game.status !== 'started' && (
              <Button size="sm" onClick={handleStartBingo} disabled={isStarting}>
                {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Swords className="h-4 w-4 mr-2" /> {t("startBingo")}
              </Button>
            )}

            <ProposeResolutionsDialog
              game={game}
              currentUserId={initialCurrentUserId}
              existingResolutions={existingResolutions}
              onReload={refreshGame}
            />

            <GameActionsMenu
              game={game}
              can={can}
              onSetGoal={() => setGoalDialogOpen(true)}
              onConfigured={refreshGame}
              onEndGame={handleEndGame}
              isEnding={isEnding}
              onDeleteGame={handleDeleteGame}
              isDeleting={isDeleting}
              onLeaveGame={handleLeaveGame}
              isLeaving={isLeaving}
            />
          </div>
        </CardHeader>

        {/* ── Team Goal Display ─────────────────────────────────── */}
        <CardContent>
          <TeamGoalDisplay
            goal={teamGoal}
            isLeader={can('game.goal.set')}
            onSetGoal={() => setGoalDialogOpen(true)}
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
            <TabsTrigger value="cards">{t("tabs.cards")}</TabsTrigger>
            <TabsTrigger value="leaderboard">{t("tabs.leaderboard")}</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-6">
            <CardsTab
              game={game}
              initialCards={cards}
              currentUserId={initialCurrentUserId}
            />
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <LeaderboardTab initialEntries={leaderboardEntries} />
          </TabsContent>
        </Tabs>
      </TeamWsProvider>
    </div>
  );
}
