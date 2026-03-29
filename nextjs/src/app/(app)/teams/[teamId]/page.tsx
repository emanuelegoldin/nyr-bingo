/**
 * Team Detail Page
 * Spec Reference: 04-bingo-teams.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md
 *
 * Server-first implementation:
 * - Authentication and team membership checks run on the server
 * - Initial team/cards/goal/resolution payloads are fetched on the server
 * - Client component only handles interactive mutations and local UI state
 */

import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import {
  getTeamBingoCards,
  getTeamGoalResolution,
  getTeamLeaderboard,
  getTeamProvidedResolutionsByUser,
  getTeamWithMembers,
  isTeamMember,
  type BingoCardWithCells,
  type Resolution,
  type TeamWithMembers,
} from '@/lib/db';
import type { ResolutionFormData } from '@/components/dialogs/resolution-create-edit-dialog';
import TeamDetailPageClient from './team-detail-page-client';
import type { BingoCardData, Team, TeamProvidedResolution } from './types';

interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  firstBingoAt: string | null;
  completedTasks: number;
}

interface TeamDetailPageProps {
  params: Promise<{ teamId: string }>;
}

function TeamDetailLoadingFallback() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

function toIsoDateString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapTeam(team: TeamWithMembers): Team {
  return {
    id: team.id,
    name: team.name,
    leaderUserId: team.leaderUserId,
    teamResolutionText: team.teamResolutionText,
    status: team.status,
    members: team.members.map((member) => ({
      membership: {
        id: member.membership.id,
        teamId: member.membership.teamId,
        userId: member.membership.userId,
        role: member.membership.role,
        joinedAt: toIsoDateString(member.membership.joinedAt),
      },
      user: {
        id: member.user.id,
        userId: member.user.userId,
        username: member.user.username,
        displayName: member.user.displayName,
        bio: member.user.bio,
        avatarUrl: member.user.avatarUrl,
      },
    })),
  };
}

function mapCards(cards: BingoCardWithCells[]): BingoCardData[] {
  return cards.map((card) => ({
    id: card.id,
    teamId: card.teamId,
    userId: card.userId,
    gridSize: card.gridSize,
    cells: card.cells.map((cell) => ({
      id: cell.id,
      cardId: cell.cardId,
      position: cell.position,
      resolutionId: cell.resolutionId,
      resolutionType: cell.resolutionType,
      resolutionText: cell.resolutionText,
      resolutionTitle: cell.resolutionTitle,
      isJoker: cell.isJoker,
      isEmpty: cell.isEmpty,
      sourceType: cell.sourceType,
      sourceUserId: cell.sourceUserId,
      state: cell.state,
      reviewThreadId: cell.reviewThreadId ?? null,
      proof: cell.proof
        ? {
            id: cell.proof.id,
            status: cell.proof.status,
          }
        : null,
    })),
  }));
}

function mapTeamProvidedResolutions(resolutions: Resolution[]): TeamProvidedResolution[] {
  return resolutions.map((resolution) => ({
    id: resolution.id,
    ownerUserId: resolution.ownerUserId,
    teamId: resolution.teamId,
    toUserId: resolution.toUserId,
    title: resolution.title,
    description: resolution.description,
    resolutionType: resolution.resolutionType,
    subtasks: resolution.subtasks,
    numberOfRepetition: resolution.numberOfRepetition,
    completedTimes: resolution.completedTimes,
  }));
}

function mapGoalToFormData(goal: Resolution | null): ResolutionFormData | null {
  if (!goal) {
    return null;
  }

  return {
    id: goal.id,
    type: goal.resolutionType as ResolutionFormData['type'],
    title: goal.title,
    text: goal.description ?? '',
    subtasks: goal.subtasks ?? undefined,
    numberOfRepetition: goal.numberOfRepetition ?? undefined,
  };
}

async function TeamDetailContent({ teamId }: { teamId: string }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect('/login');
  }

  const member = await isTeamMember(teamId, currentUser.id);
  if (!member) {
    notFound();
  }

  const team = await getTeamWithMembers(teamId);
  if (!team) {
    notFound();
  }

  // Non-critical sections are settled independently so one failed query does not block the page.
  const cardPromise = team.status === 'started'
    ? getTeamBingoCards(teamId, currentUser.id)
    : Promise.resolve([] as BingoCardWithCells[]);

  const [cardsResult, goalResult, resolutionsResult, leaderboardResult] = await Promise.allSettled([   // Return result for each promise individually so one failure does not reject the whole batch
    cardPromise,
    getTeamGoalResolution(teamId),
    getTeamProvidedResolutionsByUser(teamId, currentUser.id),
    getTeamLeaderboard(teamId),
  ]);

  const initialCards = cardsResult.status === 'fulfilled' ? mapCards(cardsResult.value) : [];
  const initialTeamGoal = goalResult.status === 'fulfilled' ? mapGoalToFormData(goalResult.value) : null;
  const initialExistingResolutions = resolutionsResult.status === 'fulfilled'
    ? mapTeamProvidedResolutions(resolutionsResult.value)
    : [];
  const initialLeaderboardEntries: LeaderboardEntry[] =
    leaderboardResult.status === 'fulfilled' ? leaderboardResult.value : [];

  return (
    <TeamDetailPageClient
      teamId={teamId}
      initialTeam={mapTeam(team)}
      initialCards={initialCards}
      initialCurrentUserId={currentUser.id}
      initialTeamGoal={initialTeamGoal}
      initialExistingResolutions={initialExistingResolutions}
      initialLeaderboardEntries={initialLeaderboardEntries}
    />
  );
}

export default async function TeamDetailPage({ params }: TeamDetailPageProps) {
  const { teamId } = await params;

  return (
    <Suspense fallback={<TeamDetailLoadingFallback />}>
      <TeamDetailContent teamId={teamId} />
    </Suspense>
  );
}
