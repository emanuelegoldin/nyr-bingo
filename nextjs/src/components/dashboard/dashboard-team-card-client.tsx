"use client";

import { DashboardBingoCardProvider } from '@/components/bingo-card/BingoCardProvider';
import { TeamMembersMap, TeamMembersProvider } from '@/components/team-members-context';
import { TeamRefreshListener } from '@/components/team-refresh-listener';
import { TeamWsProvider } from '@/components/team-ws-provider';
import { Card } from '@/components/ui/card';
import type { BingoCardWithCells, TeamWithMembers } from '@/lib/db/types';
import { useMemo } from 'react';

// Helper type for passing translation strings to avoid issues with importing server functions into client components
type DashboardText = {
  cardTitle: string;
  headerDescription: string;
};

interface DashboardTeamCardClientProps {
  team: TeamWithMembers;
  currentUserId: string;
  initialCard: BingoCardWithCells;
  dashboardText: DashboardText;
}

export default function DashboardTeamCardClient({
  team,
  currentUserId,
  initialCard,
  dashboardText,
}: DashboardTeamCardClientProps) {
  const membersMap = useMemo<TeamMembersMap>(() => {
    const map: TeamMembersMap = {};
    for (const member of team.members) {
      map[member.user.userId] = member.user.displayName || member.user.username;
    }
    return map;
  }, [team.members]);

  return (
    <TeamWsProvider teamId={team.id} teamName={team.name}>
      <TeamRefreshListener />
      <TeamMembersProvider members={membersMap}>
        <Card className="w-full max-w-4xl mx-auto">
          <DashboardBingoCardProvider
            user={{ id: currentUserId, username: membersMap[currentUserId] || 'Unknown User' }}
            initialCard={initialCard}
            isOwner={true}
            teamId={team.id}
            currentUserId={currentUserId}
            cardFetchInput={`/api/teams/${team.id}/cards?userId=${currentUserId}`}
            // Pass translation strings to avoid issues with importing server functions into client components
            dashboardText={dashboardText}
          />
        </Card>
      </TeamMembersProvider>
    </TeamWsProvider>
  );
}
