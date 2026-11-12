"use client";

/**
 * Game Page
 * Spec Reference: 16-games.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md
 *
 * The tabs depend on the game's phase (spec 12):
 *   - Preparation: Personal (the caller's own resolutions) and Teammates (resolutions for the others)
 *   - Started: Cards, Leaderboard, Threads, Progress, Personal and Teammates
 */

import { ResolutionCreateEditDialog } from "@/components/dialogs/resolution-create-edit-dialog";
import { ProgressTab } from "@/components/progress/progress-tab";
import { ArchivedThreadsTab } from "@/components/threads/archived-threads-tab";
import { TeamRefreshListener } from "@/components/team-refresh-listener";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { GameStatusBadge } from "@/components/team/game-status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePageTitle } from "@/hooks/AppContext";
import { useTranslations } from "next-intl";
import { useState } from 'react';

import type { GamePermission } from "@/lib/authz/permissions";
import { BingoCardWithCells } from "@/lib/db/types";
import { GameStatus } from "@/lib/shared/types";
import type {
  ArchivedThread,
  LeaderboardEntry,
  ProgressPoint,
  ResolutionFormData,
  UnifiedResolution,
} from "@/lib/shared/types";
import { DeadlineInfo } from "./_components/DeadlineInfo";
import { GameActionsMenu } from "./_components/GameActionsMenu";
import { MissingTeamGoalNotice } from "./_components/MissingTeamGoalNotice";
import { PersonalTab } from "./_components/PersonalTab";
import { ReadyButton } from "./_components/ReadyButton";
import { TeammatesTab } from "./_components/TeammatesTab";
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
  /** The caller's personal resolutions of the game, newest first. */
  initialPersonalResolutions?: UnifiedResolution[];
  initialLeaderboardEntries?: LeaderboardEntry[];
  initialArchivedThreads?: ArchivedThread[];
  initialProgressPoints?: ProgressPoint[];
}

export default function GameDetailPageClient({
  initialGame,
  initialCards,
  initialCurrentUserId,
  capabilities,
  initialTeamGoal,
  initialExistingResolutions,
  initialPersonalResolutions,
  initialLeaderboardEntries,
  initialArchivedThreads,
  initialProgressPoints,
}: GameDetailPageClientProps) {
  const t = useTranslations("Games.detail");
  usePageTitle(t("pageTitle"));

  const cards = useLastLoaded<BingoCardWithCells[]>(initialCards, []);
  const personalResolutions = useLastLoaded<UnifiedResolution[]>(initialPersonalResolutions, []);
  const leaderboardEntries = useLastLoaded<LeaderboardEntry[]>(initialLeaderboardEntries, []);
  const archivedThreads = useLastLoaded<ArchivedThread[]>(initialArchivedThreads, []);
  const progressPoints = useLastLoaded<ProgressPoint[]>(initialProgressPoints, []);

  const {
    game,
    teamGoal,
    existingResolutions,
    refreshGame,
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
  const inPreparation = game.status === GameStatus.FORMING;

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
            <DeadlineInfo
              status={game.status}
              preparationDeadline={game.preparationDeadline}
              deadline={game.deadline}
            />
            <div className="mt-2">
              <GameStatusBadge status={game.status} />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {inPreparation && can('game.ready') && (
              <ReadyButton
                gameId={game.id}
                isReady={game.readyPlayerIds.includes(initialCurrentUserId)}
                readyCount={game.readyPlayerIds.length}
                playerCount={game.members.length}
                onChanged={refreshGame}
              />
            )}

            <GameActionsMenu
              game={game}
              can={can}
              onSetGoal={() => setGoalDialogOpen(true)}
              onConfigured={refreshGame}
              onInvited={refreshGame}
              onEndGame={handleEndGame}
              isEnding={isEnding}
              onDeleteGame={handleDeleteGame}
              isDeleting={isDeleting}
              onLeaveGame={handleLeaveGame}
              isLeaving={isLeaving}
            />
          </div>
        </CardHeader>

        {/* ── Missing Team Goal Notice ──────────────────────────── */}
        {!teamGoal && (
          <CardContent>
            <MissingTeamGoalNotice
              isLeader={can('game.goal.set')}
              inPreparation={inPreparation}
              onSetGoal={() => setGoalDialogOpen(true)}
            />
          </CardContent>
        )}
      </Card>

      {/* ── Team Goal Resolution Dialog ────────────────────────── */}
      <ResolutionCreateEditDialog
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
        {/* Keyed by phase, so the started tabs open on Cards once the game starts (spec 12) */}
        <Tabs key={game.status} defaultValue={inPreparation ? "personal" : "cards"}>
          <TabsList className="flex-wrap h-auto">
            {!inPreparation && (
              <>
                <TabsTrigger value="cards">{t("tabs.cards")}</TabsTrigger>
                <TabsTrigger value="leaderboard">{t("tabs.leaderboard")}</TabsTrigger>
                <TabsTrigger value="threads">{t("tabs.threads")}</TabsTrigger>
                <TabsTrigger value="progress">{t("tabs.progress")}</TabsTrigger>
              </>
            )}
            <TabsTrigger value="personal">{t("tabs.personal")}</TabsTrigger>
            <TabsTrigger value="teammates">{t("tabs.teammates")}</TabsTrigger>
          </TabsList>

          {!inPreparation && (
            <>
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

              <TabsContent value="threads" className="mt-6">
                <ArchivedThreadsTab
                  threads={archivedThreads}
                  getDeleteUrl={can('thread.delete') ? (threadId) => `/api/threads/${threadId}` : undefined}
                />
              </TabsContent>

              <TabsContent value="progress" className="mt-6">
                <ProgressTab
                  started
                  leaderboard={leaderboardEntries}
                  points={progressPoints}
                  startedAt={game.startedAt}
                  endedAt={null}
                />
              </TabsContent>
            </>
          )}

          <TabsContent value="personal" className="mt-6">
            <PersonalTab game={game} resolutions={personalResolutions} onReload={refreshGame} />
          </TabsContent>

          <TabsContent value="teammates" className="mt-6">
            <TeammatesTab
              game={game}
              currentUserId={initialCurrentUserId}
              existingResolutions={existingResolutions}
              onReload={refreshGame}
            />
          </TabsContent>
        </Tabs>
      </TeamWsProvider>
    </div>
  );
}
