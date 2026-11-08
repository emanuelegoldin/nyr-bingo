/**
 * Game Page
 * Spec Reference: 16-games.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md, 23-progress-chart.md,
 * 03-personal-resolutions.md - Read
 *
 * Server-first implementation:
 * - Authentication and team membership checks run on the server
 * - Initial game/cards/goal/resolution payloads are fetched on the server
 * - Client component only handles interactive mutations and local UI state
 */

import { PageSpinner } from '@/components/page-spinner';
import { toTeamMember } from '@/components/team/types';
import { requireUser } from '@/lib/auth';
import { getGameCapabilities, requirePagePermission } from '@/lib/authz';
import {
  getClosedGameThreads,
  getGameBingoCards,
  getGameGoalResolution,
  getGameLeaderboard,
  getGameProgress,
  getGameWithMembers,
  getMemberProvidedResolutionsByUser,
  getPlayerGameResolutions,
  getReadyPlayerIds,
  type BingoCardWithCells,
  type GameWithMembers,
  type Resolution,
} from '@/lib/db';
import { resolutionToFormData, toUnifiedResolution } from '@/lib/shared/resolution-form';
import type {
  ArchivedThread,
  LeaderboardEntry,
  ProgressPoint,
  ResolutionFormData,
  UnifiedResolution,
} from '@/lib/shared/types';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import GameDetailPageClient from './game-detail-page-client';
import type { Game } from './types';

interface GameDetailPageProps {
  params: Promise<{ gameId: string }>;
}

function GameDetailLoadingFallback() {
  return (
    <PageSpinner />
  );
}

function mapGame(game: GameWithMembers, readyPlayerIds: string[]): Game {
  return {
    id: game.id,
    teamId: game.teamId,
    teamName: game.teamName,
    name: game.name,
    teamResolutionText: game.teamResolutionText,
    status: game.status,
    startedAt: game.startedAt ? game.startedAt.toISOString() : null,
    deadline: game.deadline,
    preparationDeadline: game.preparationDeadline,
    gridSize: game.gridSize,
    members: game.members.map(toTeamMember),
    readyPlayerIds,
  };
}

function mapGoalToFormData(goal: Resolution | null): ResolutionFormData | null {
  if (!goal) {
    return null;
  }

  return resolutionToFormData(goal);
}

async function GameDetailContent({ gameId }: { gameId: string }) {
  const currentUser = await requireUser();

  // An ended game is not found either (spec 16)
  const game = await getGameWithMembers(gameId);
  if (!game) {
    notFound();
  }

  await requirePagePermission(currentUser, 'game.view', { scope: 'game', game });

  // Non-critical sections are settled independently so one failed query does not block the page.
  const cardPromise = game.status === 'started'
    ? getGameBingoCards(gameId)
    : Promise.resolve([] as BingoCardWithCells[]);

  const capabilities = await getGameCapabilities(currentUser, game);

  const [
    cardsResult,
    goalResult,
    resolutionsResult,
    personalResult,
    leaderboardResult,
    threadsResult,
    progressResult,
  ] = await Promise.allSettled([   // Return result for each promise individually so one failure does not reject the whole batch
    cardPromise,
    getGameGoalResolution(gameId),
    getMemberProvidedResolutionsByUser(gameId, currentUser.id),
    getPlayerGameResolutions(gameId, currentUser.id),
    getGameLeaderboard(gameId),
    getClosedGameThreads(gameId),
    getGameProgress(gameId),
  ]);
  const readyPlayerIds = await getReadyPlayerIds(gameId);

  // undefined marks a failed read, so a refresh keeps the data already on screen
  const initialCards = cardsResult.status === 'fulfilled' ? cardsResult.value : undefined;
  const initialTeamGoal = goalResult.status === 'fulfilled' ? mapGoalToFormData(goalResult.value) : undefined;
  const initialExistingResolutions = resolutionsResult.status === 'fulfilled'
    ? resolutionsResult.value
    : undefined;
  const initialPersonalResolutions: UnifiedResolution[] | undefined = personalResult.status === 'fulfilled'
    ? personalResult.value.map(toUnifiedResolution)
    : undefined;
  const initialLeaderboardEntries: LeaderboardEntry[] | undefined =
    leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : undefined;
  const initialArchivedThreads: ArchivedThread[] | undefined =
    threadsResult.status === 'fulfilled' ? threadsResult.value : undefined;
  const initialProgressPoints: ProgressPoint[] | undefined =
    progressResult.status === 'fulfilled' ? progressResult.value : undefined;

  return (
    <GameDetailPageClient
      initialGame={mapGame(game, readyPlayerIds)}
      initialCards={initialCards}
      initialCurrentUserId={currentUser.id}
      capabilities={capabilities}
      initialTeamGoal={initialTeamGoal}
      initialExistingResolutions={initialExistingResolutions}
      initialPersonalResolutions={initialPersonalResolutions}
      initialLeaderboardEntries={initialLeaderboardEntries}
      initialArchivedThreads={initialArchivedThreads}
      initialProgressPoints={initialProgressPoints}
    />
  );
}

export default async function GameDetailPage({ params }: GameDetailPageProps) {
  const { gameId } = await params;

  return (
    <Suspense fallback={<GameDetailLoadingFallback />}>
      <GameDetailContent gameId={gameId} />
    </Suspense>
  );
}
