"use client";

import { DashboardBingoCardProvider } from '@/components/bingo-card/BingoCardProvider';
import { TeamMembersMap, TeamMembersProvider } from '@/components/team-members-context';
import { TeamWsProvider } from '@/components/team-ws-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { BingoCardWithCells, TeamWithMembers } from '@/lib/db/types';
import { useMemo, useState } from 'react';

interface DashboardTeamCardClientProps {
  team: TeamWithMembers;
  currentUserId: string;
  initialCard: BingoCardWithCells;
}

export default function DashboardTeamCardClient({
  team,
  currentUserId,
  initialCard,
}: DashboardTeamCardClientProps) {
  const [card, setCard] = useState<BingoCardWithCells>(initialCard);

  const membersMap = useMemo<TeamMembersMap>(() => {
    const map: TeamMembersMap = {};
    for (const member of team.members) {
      map[member.user.userId] = member.user.displayName || member.user.username;
    }
    return map;
  }, [team.members]);

  return (
    <TeamWsProvider teamId={team.id}>
      <TeamMembersProvider members={membersMap}>
        <Card className="w-full max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="font-headline text-2xl">
              Your Bingo Card for "{team.name}"
            </CardTitle>
            <CardDescription>
              Complete your resolutions to get a BINGO! Click on a cell to mark it as completed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardBingoCardProvider
              user={{ id: currentUserId, username: membersMap[currentUserId] || 'Unknown User' }}
              initialCard={card}
              isOwner={true}
              teamId={team.id}
              currentUserId={currentUserId}
              cardFetchInput={`/api/teams/${team.id}/cards?userId=${currentUserId}`}
            />
          </CardContent>
        </Card>
      </TeamMembersProvider>
    </TeamWsProvider>
  );
}
