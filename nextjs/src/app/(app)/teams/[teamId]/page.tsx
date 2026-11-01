/**
 * Team Page
 * Spec Reference: 04-bingo-teams.md - Team Page
 *
 * Authentication and team membership checks run on the server.
 */

import { PageSpinner } from '@/components/page-spinner';
import type { GameListItem } from '@/components/team/game-list';
import type { Team } from '@/components/team/types';
import { requireUser } from '@/lib/auth';
import { getRunningGamesForTeam, getTeamWithMembers, isTeamMember, type TeamWithMembers } from '@/lib/db';
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
    leaderUserId: team.leaderUserId,
    members: team.members.map((member) => ({
      membership: {
        id: member.membership.id,
        teamId: member.membership.teamId,
        userId: member.membership.userId,
        role: member.membership.role,
        joinedAt: new Date(member.membership.joinedAt).toISOString(),
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

async function TeamContent({ teamId }: { teamId: string }) {
  const currentUser = await requireUser();

  const member = await isTeamMember(teamId, currentUser.id);
  if (!member) {
    notFound();
  }

  const [team, games] = await Promise.all([
    getTeamWithMembers(teamId),
    getRunningGamesForTeam(teamId),
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

  return <TeamPageClient team={mapTeam(team)} games={gameItems} currentUserId={currentUser.id} />;
}

export default async function TeamPage({ params }: TeamPageProps) {
  const { teamId } = await params;

  return (
    <Suspense fallback={<PageSpinner />}>
      <TeamContent teamId={teamId} />
    </Suspense>
  );
}
