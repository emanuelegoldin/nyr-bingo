"use client";

import { DashboardBingoCardProvider } from '@/components/bingo-card/BingoCardProvider';
import { TeamMembersMap, TeamMembersProvider } from '@/components/team-members-context';
import { TeamRefreshListener } from '@/components/team-refresh-listener';
import { TeamWsProvider } from '@/components/team-ws-provider';
import { Card } from '@/components/ui/card';
import type { BingoCardWithCells, GameWithMembers } from '@/lib/db/types';
import { useMemo } from 'react';

interface DashboardGameCardClientProps {
  game: GameWithMembers;
  currentUserId: string;
  initialCard: BingoCardWithCells;
}

export default function DashboardGameCardClient({
  game,
  currentUserId,
  initialCard,
}: DashboardGameCardClientProps) {
  const membersMap = useMemo<TeamMembersMap>(() => {
    const map: TeamMembersMap = {};
    for (const member of game.members) {
      map[member.user.userId] = member.user.displayName || member.user.username;
    }
    return map;
  }, [game.members]);

  return (
    <TeamWsProvider teamId={game.teamId}>
      <TeamRefreshListener />
      <TeamMembersProvider members={membersMap}>
        <Card className="w-full max-w-4xl mx-auto">
          <DashboardBingoCardProvider
            user={{ id: currentUserId, username: membersMap[currentUserId] || 'Unknown User' }}
            initialCard={initialCard}
            isOwner={true}
            gameId={game.id}
            currentUserId={currentUserId}
            cardUserId={currentUserId}
            gameName={game.name}
          />
        </Card>
      </TeamMembersProvider>
    </TeamWsProvider>
  );
}
