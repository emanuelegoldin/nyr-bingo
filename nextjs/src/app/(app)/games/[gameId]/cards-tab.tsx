"use client";

/**
 * Cards Tab — Game Page
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
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import type { Game } from "./types";

interface CardsTabProps {
  game: Game;
  initialCards: BingoCardWithCells[];
  currentUserId: string;
}

export function CardsTab({
  game,
  initialCards: cards,
  currentUserId,
}: CardsTabProps) {
  const t = useTranslations("Games.cardsTab");
  // Build the userId → username map once from the already-loaded game data.
  const membersMap = useMemo(
    () =>
      Object.fromEntries(
        game.members.map((m) => [m.user.userId, m.user.username])
      ),
    [game.members]
  );

  if (game.status === "forming") {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <h3 className="text-xl font-semibold font-headline mb-2">{t("notStartedTitle")}</h3>
          <p className="text-muted-foreground">
            {t("notStartedDescription")}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">{t("noCards")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <TeamMembersProvider members={membersMap}>
      <div className="space-y-8">
        <h2 className="text-2xl font-bold font-headline">{t("heading")}</h2>

        {game.members.map((member, index) => {
          const card = cards.find((c) => c.userId === member.user.userId);
          const isCurrentUser = member.user.userId === currentUserId;

          return (
            <div key={member.user.userId}>
              {card ? (
                <TeamBingoCardProvider
                  user={member.user}
                  initialCard={card}
                  isOwner={isCurrentUser}
                  gameId={game.id}
                  currentUserId={currentUserId}
                  cardUserId={member.user.userId}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  {t("noCard")}
                </p>
              )}
              {index < game.members.length - 1 && <Separator className="my-8" />}
            </div>
          );
        })}
      </div>
    </TeamMembersProvider>
  );
}
