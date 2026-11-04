"use client"; // required for useState, useEffect, etc.

import { BingoCardWithCells } from "@/lib/db/types";
import { Card, CardDescription, CardHeader, CardTitle } from "@ui/card";
import { createContext, useMemo, useState } from "react";
import { BingoCardContent } from "./BingoCardContent";
import { BingoCardEditButton } from "./dashboard-page/BingoCardEditButton";
import { ProfileInfo } from "./team-page/ProfileInfo";

type BaseBingoCardProviderProps = {
  user: { id: string; username: string };
  initialCard: BingoCardWithCells;
  isOwner: boolean;
  gameId: string;
  currentUserId: string;
  /** The player whose card is shown, used to reload it. */
  cardUserId: string;
  headerSlot?: React.ReactNode;
};

type BingoCardContextType = {
  user: {
    id: string;
    username: string;
  };
  isEditMode: boolean;
  setEditMode: (editMode: boolean) => void;
};

export const BingoCardContext = createContext<BingoCardContextType>({
  user: {
    id: "",
    username: "",
  },
  isEditMode: false,
  setEditMode: () => { },
});

/**
 * A player's bingo card with a header slot, sharing the card owner and the edit mode with
 * the header components through BingoCardContext.
 *
 * @param props - The card, its owner and viewer, and the header content.
 * @returns The card.
 */
function BingoCard({
  user,
  initialCard,
  isOwner,
  gameId,
  currentUserId,
  cardUserId,
  headerSlot,
}: BaseBingoCardProviderProps) {
  const [editMode, setEditMode] = useState(false);

  const contextValue = useMemo(() => ({
    user,
    isEditMode: editMode,
    setEditMode,
  }), [user, editMode]);

  return (
    <BingoCardContext value={contextValue}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            {headerSlot}
          </div>
        </CardHeader>
        <BingoCardContent
          initialCard={initialCard}
          isOwner={isOwner}
          editMode={editMode}
          gameId={gameId}
          currentUserId={currentUserId}
          cardUserId={cardUserId}
        />
      </Card>
    </BingoCardContext>
  );
}

/**
 * Card of a player on the game page, headed by the player's avatar and name.
 *
 * @param props - The card, its owner and viewer.
 * @returns The card.
 */
export function TeamBingoCardProvider(props: Omit<BaseBingoCardProviderProps, 'headerSlot'>) {
  return (
    <BingoCard
      {...props}
      headerSlot={<ProfileInfo isCurrentUser={props.isOwner} />}
    />
  );
}

// Helper type for passing translation strings to avoid issues with importing server functions into client components
type DashboardBingoCardProviderProps = Omit<BaseBingoCardProviderProps, "headerSlot"> & {
  gameName: string;
  dashboardText: {
    cardTitle: string;
    headerDescription: string;
  };
};

/**
 * The current user's card on the dashboard, headed by the game name and the edit button.
 *
 * @param props - The card, its owner, the game name and the translated header text.
 * @returns The card.
 */
export function DashboardBingoCardProvider({
  gameName,
  dashboardText,
  ...props
}: DashboardBingoCardProviderProps) {
  const headerSlot = (
    <div className="flex w-full items-start justify-between gap-4">
      <div className="min-w-0">
        <CardTitle className="font-headline text-2xl">
          {dashboardText.cardTitle.replace('{gameName}', gameName)}
        </CardTitle>
        <CardDescription>
          {dashboardText.headerDescription}
        </CardDescription>
      </div>

      <div className="shrink-0">
        <BingoCardEditButton />
      </div>
    </div>
  );

  return (
    <BingoCard
      {...props}
      headerSlot={headerSlot}
    />
  );
}
