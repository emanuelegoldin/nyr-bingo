"use client";

/**
 * Cards Tab — Team Detail Page
 * Spec Reference: 06-bingo-gameplay.md, 08-visibility-and-updates.md
 *
 * Displays every team member's bingo card. The current user can interact
 * with their own card (mark cells completed, undo, etc.). Other cards
 * are view-only.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { BingoCard } from "@/components/bingo-card";
import { TeamMembersProvider } from "@/components/team-members-context";
import { TeamWsProvider } from "@/components/team-ws-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import type { Team, BingoCardData } from "./types";

interface CardsTabProps {
  teamId: string;
  team: Team;
  initialCards: BingoCardData[];
  currentUserId: string;
}

export function CardsTab({
  teamId,
  team,
  initialCards,
  currentUserId,
}: CardsTabProps) {
  const { toast } = useToast();
  const [cards, setCards] = useState<BingoCardData[]>(initialCards);

  const loadCards = useCallback(async () => {
    try {
      const cardsRes = await fetch(`/api/teams/${teamId}/cards`);
      const cardsData = await cardsRes.json();
      if (cardsRes.ok) {
        setCards(cardsData.cards || []);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to refresh cards",
        variant: "destructive",
      });
    }
  }, [teamId, toast]);

  useEffect(() => {
    // When the game transitions to started after initial render, fetch cards.
    if (team.status === "started" && cards.length === 0) {
      loadCards();
    }
  }, [cards.length, loadCards, team.status]);

  const handleCellUpdate = useCallback(
    async (cellId: string, newState: "pending" | "completed") => {
      try {
        const response =
          newState === "pending"
            ? await fetch(`/api/cells/${cellId}/undo-complete`, { method: "POST" })
            : await fetch(`/api/cells/${cellId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: newState }),
              });

        if (response.ok) {
          await loadCards();
          return;
        }

        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update cell",
          variant: "destructive",
        });
      } catch {
        toast({
          title: "Error",
          description: "An error occurred",
          variant: "destructive",
        });
      }
    },
    [loadCards, toast]
  );

  // Build the userId → username map once from the already-loaded team data.
  const membersMap = useMemo(
    () =>
      Object.fromEntries(
        team.members.map((m) => [m.user.userId, m.user.username])
      ),
    [team.members]
  );

  if (team.status === "forming") {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-xl font-semibold font-headline mb-2">Game Not Started Yet</h3>
          <p className="text-muted-foreground">
            The team leader will start the game once everyone has proposed resolutions for each
            other.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">No bingo cards available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TeamWsProvider teamId={team.id} onRefresh={loadCards}>
    <TeamMembersProvider members={membersMap}>
    <div className="space-y-8">
      <h2 className="text-2xl font-bold font-headline">Bingo Cards</h2>

      {team.members.map((member, index) => {
        const card = cards.find((c) => c.userId === member.user.userId);
        const isCurrentUser = member.user.userId === currentUserId;

        return (
          <div key={member.user.userId}>
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {/* Clickable avatar → profile page */}
                  <Link href={`/profile/${member.user.userId}`}>
                    <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
                      <AvatarFallback>
                        {(member.user.displayName || member.user.username)?.charAt(0) || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </Link>
                  <CardTitle className="font-headline text-xl">
                    {member.user.displayName || member.user.username}
                    {isCurrentUser && " (You)"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {card ? (
                  <BingoCard
                    cells={card.cells}
                    isOwner={isCurrentUser}
                    teamId={team.id}
                    currentUserId={currentUserId}
                    onCellUpdate={isCurrentUser ? handleCellUpdate : undefined}
                    onRefresh={loadCards}
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No bingo card available
                  </p>
                )}
              </CardContent>
            </Card>
            {index < team.members.length - 1 && <Separator className="my-8" />}
          </div>
        );
      })}
    </div>
    </TeamMembersProvider>
    </TeamWsProvider>
  );
}
