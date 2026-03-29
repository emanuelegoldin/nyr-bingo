"use client";

import { useCallback, useMemo, useState } from 'react';
import { BingoCard } from '@/components/bingo-card';
import { TeamMembersProvider, TeamMembersMap } from '@/components/team-members-context';
import { TeamWsProvider } from '@/components/team-ws-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { BingoCardWithCells, TeamWithMembers } from '@/lib/db/types';

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
  const { toast } = useToast();
  const [card, setCard] = useState<BingoCardWithCells>(initialCard);

  const membersMap = useMemo<TeamMembersMap>(() => {
    const map: TeamMembersMap = {};
    for (const member of team.members) {
      map[member.user.userId] = member.user.displayName || member.user.username;
    }
    return map;
  }, [team.members]);

  const reloadCard = useCallback(async () => {
    try {
      const response = await fetch(`/api/teams/${team.id}/cards?userId=${currentUserId}`);
      const data = await response.json();

      if (!response.ok || !data.card) {
        toast({
          title: 'Error',
          description: data.error || `Failed to refresh card for ${team.name}`,
          variant: 'destructive',
        });
        return;
      }

      setCard(data.card);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to refresh card',
        variant: 'destructive',
      });
    }
  }, [currentUserId, team.id, team.name, toast]);

  const handleCellUpdate = useCallback(
    async (cellId: string, newState: 'pending' | 'completed') => {
      try {
        const response =
          newState === 'pending'
            ? await fetch(`/api/cells/${cellId}/undo-complete`, { method: 'POST' })
            : await fetch(`/api/cells/${cellId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ state: newState }),
              });

        if (response.ok) {
          await reloadCard();
          return;
        }

        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Failed to update cell',
          variant: 'destructive',
        });
      } catch {
        toast({
          title: 'Error',
          description: 'An error occurred',
          variant: 'destructive',
        });
      }
    },
    [reloadCard, toast]
  );

  return (
    <TeamWsProvider teamId={team.id} onRefresh={reloadCard}>
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
            <BingoCard
              cells={card.cells}
              isOwner={true}
              teamId={team.id}
              currentUserId={currentUserId}
              onCellUpdate={handleCellUpdate}
              onRefresh={reloadCard}
            />
          </CardContent>
        </Card>
      </TeamMembersProvider>
    </TeamWsProvider>
  );
}
