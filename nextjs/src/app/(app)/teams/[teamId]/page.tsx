/**
 * Team Page
 * Spec Reference: 04-bingo-teams.md - Team Page
 *
 * Authentication and team membership checks run on the server.
 */

import { PageSpinner } from '@/components/page-spinner';
import type { GameListItem } from '@/components/team/game-list';
import { toTeamMember, type Team } from '@/components/team/types';
import { requireUser } from '@/lib/auth';
import { getTeamCapabilities, requirePagePermission } from '@/lib/authz';
import { getRunningGamesForTeam, getTeamWithMembers, type TeamWithMembers } from '@/lib/db';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import TeamPageClient from './team-page-client';

interface TeamPageProps {
  params: Promise<{ teamId: string }>;
}

function mapTeam(team: TeamWithMembers): Team {
  return {
    id: team.id,
    name: team.name,
    members: team.members.map(toTeamMember),
  };
}

async function TeamContent({ teamId }: { teamId: string }) {
  const currentUser = await requireUser();

  await requirePagePermission(currentUser, 'team.view', { scope: 'team', teamId });

  const [team, games, capabilities] = await Promise.all([
    getTeamWithMembers(teamId),
    getRunningGamesForTeam(teamId, currentUser.id),
    getTeamCapabilities(currentUser, teamId),
  ]);
  if (!team) {
    notFound();
  }

  const gameItems: GameListItem[] = games.map(({ id, name, teamName, status }) => ({
    id,
    name,
    teamName,
    status,
  }));

  return (
    <TeamPageClient
      team={mapTeam(team)}
      games={gameItems}
      currentUserId={currentUser.id}
      capabilities={capabilities}
    />
  );
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params;

  return (
    <Suspense fallback={<PageSpinner />}>
      <TeamContent teamId={teamId} />
    </Suspense>
  );
}
