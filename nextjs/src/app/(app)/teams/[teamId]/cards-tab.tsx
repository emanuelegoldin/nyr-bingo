"use client";

/**
 * Cards Tab — Team Detail Page
 * Spec Reference: 06-bingo-gameplay.md, 08-visibility-and-updates.md
 *
 * Displays every team member's bingo card. The current user can interact
 * with their own card (mark cells completed, undo, etc.). Other cards
 * are view-only.
 */

import { TeamBingoCardProvider } from "@/components/bingo-card/BingoCardProvider";
import { TeamMembersProvider } from "@/components/team-members-context";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BingoCardWithCells } from "@/lib/db/types";
import { useMemo } from "react";
import type { Team } from "./types";

interface CardsTabProps {
  team: Team;
  initialCards: BingoCardWithCells[];
  currentUserId: string;
}

export function CardsTab({
  team,
  initialCards: cards,
  currentUserId,
}: CardsTabProps) {
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
    <TeamMembersProvider members={membersMap}>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold font-headline">Bingo Cards</h2>

        {team.members.map((member, index) => {
          const card = cards.find((c) => c.userId === member.user.userId);
          const isCurrentUser = member.user.userId === currentUserId;

          return (
            <div key={member.user.userId}>
              {card ? (
                <TeamBingoCardProvider
                  user={member.user}
                  initialCard={card}
                  isOwner={isCurrentUser}
                  teamId={team.id}
                  currentUserId={currentUserId}
                  cardFetchInput={`/api/teams/${team.id}/cards?userId=${member.user.userId}`}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No bingo card available
                </p>
              )}
              {index < team.members.length - 1 && <Separator className="my-8" />}
            </div>
          );
        })}
      </div>
    </TeamMembersProvider>
  );
}
