/**
 * Team Detail Page
 * Spec Reference: 04-bingo-teams.md, 05-bingo-card-generation.md, 06-bingo-gameplay.md, 12-team-tabs.md
 *
 * Server-first implementation:
 * - Authentication and team membership checks run on the server
 * - Initial team/cards/goal/resolution payloads are fetched on the server
 * - Client component only handles interactive mutations and local UI state
 */

import { requireUser } from '@/lib/auth';
import {
  getTeamBingoCards,
  getTeamGoalResolution,
  getTeamLeaderboard,
  getMemberProvidedResolutionsByUser,
  getTeamWithMembers,
  isTeamMember,
  type BingoCardWithCells,
  type Resolution,
  type TeamWithMembers,
} from '@/lib/db';
import { resolutionToFormData } from '@/lib/shared/resolution-form';
import type { ResolutionFormData } from '@/lib/shared/types';
import { PageSpinner } from '@/components/page-spinner';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { LeaderboardEntry } from './leaderboard-tab';
import TeamDetailPageClient from './team-detail-page-client';
import type { Team } from './types';

interface TeamDetailPageProps {
  params: Promise<{ teamId: string }>;
}

function TeamDetailLoadingFallback() {
  return (
    <PageSpinner />
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

function mapGoalToFormData(goal: Resolution | null): ResolutionFormData | null {
  if (!goal) {
    return null;
  }

  return resolutionToFormData(goal);
}

async function TeamDetailContent({ teamId }: { teamId: string }) {
  const currentUser = await requireUser();

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
    getMemberProvidedResolutionsByUser(teamId, currentUser.id),
    getTeamLeaderboard(teamId),
  ]);

  const initialCards = cardsResult.status === 'fulfilled' ? cardsResult.value : [];
  const initialTeamGoal = goalResult.status === 'fulfilled' ? mapGoalToFormData(goalResult.value) : null;
  const initialExistingResolutions = resolutionsResult.status === 'fulfilled'
    ? resolutionsResult.value
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
