"use client"; // required for useState, useEffect, etc.

import { BingoCardWithCells } from "@/lib/db/types";
import { Card, CardDescription, CardHeader, CardTitle } from "@ui/card";
import { createContext, useMemo, useState } from "react";
import { useTeamWs } from "../team-ws-provider";
import { BingoCardContent } from "./BingoCardContent";
import { BingoCardEditButton } from "./dashboard-page/BingoCardEditButton";
import { ProfileInfo } from "./team-page/ProfileInfo";

type BaseBingoCardProviderProps = {
    user: { id: string; username: string },
    initialCard: BingoCardWithCells,
    isOwner: boolean,
    teamId: string,
    currentUserId: string,
    triggerRefresh?: () => boolean,
    cardFetchInput?: string | URL | Request
    headerSlot?: React.ReactNode
    children?: React.ReactNode
    broadcastRefresh?: () => void
};

type BingoCardContextType = {
    user: {
        id: string;
        username: string;
    },
    isEditMode: boolean;
    actions: {
        setEditMode: (editMode: boolean) => void;
    };
};

export const BingoCardContext = createContext<BingoCardContextType>({
    user: {
        id: "",
        username: "",
    },
    isEditMode: false,
    actions: {
        setEditMode: () => { },
    }
});

function BingoCard(
    {
        user,
        initialCard,
        isOwner,
        teamId,
        currentUserId,
        triggerRefresh,
        cardFetchInput,
        headerSlot,
        broadcastRefresh
    }: BaseBingoCardProviderProps
) {
    const [editMode, setEditMode] = useState(false);

    // Memoize the actions object to prevent creating new context value on every render
    const actions = useMemo(() => ({
        setEditMode: (newEditMode: boolean) => {
            setEditMode(newEditMode);
        }
    }), []);

    const contextValue = useMemo(() => ({
        user: user,
        isEditMode: editMode,
        actions,
    }), [user, editMode, actions]);

    return (
        <BingoCard.Provider>
            <BingoCardContext value={contextValue}>
                <BingoCard.Frame>
                    <BingoCard.Header>
                        {/* <BingoCard.ProfileInfo isCurrentUser={isOwner} /> */}
                        {headerSlot}
                    </BingoCard.Header>
                    {/* Fetch cells --> maybe use custom hook? */}
                    <BingoCard.Content
                        initialCard={initialCard}
                        isOwner={isOwner}
                        editMode={editMode}
                        teamId={teamId}
                        currentUserId={currentUserId}
                        triggerRefresh={triggerRefresh}
                        fetchInput={cardFetchInput}
                        broadcastRefresh={broadcastRefresh}
                    />
                </BingoCard.Frame>
            </BingoCardContext>
        </BingoCard.Provider>
    )
}

BingoCard.Provider = function ({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
        </>
    )
}

BingoCard.Frame = function ({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Card>
                {children}
            </Card>
        </>
    )
}

BingoCard.Header = function ({ children }: { children?: React.ReactNode }) {
    return (
        <>
            <CardHeader>
                <div className="flex items-center gap-3">
                    {children}
                </div>
            </CardHeader>
        </>
    )
}

BingoCard.ProfileInfo = ProfileInfo;

BingoCard.Content = BingoCardContent;  // Reuse the BingoCardContent component defined in card.tsx

export function TeamBingoCardProvider(props: Omit<BaseBingoCardProviderProps, 'headerSlot'>) {
    const { broadcastCardRefresh } = useTeamWs();

    const headerSlot = (
        <>
            <ProfileInfo isCurrentUser={props.isOwner} />
        </>
    );

    return (
        <BingoCard
            {...props}
            headerSlot={headerSlot}
            broadcastRefresh={broadcastCardRefresh}
        />
    );
}

// Helper type for passing translation strings to avoid issues with importing server functions into client components
type DashboardBingoCardProviderProps = Omit<BaseBingoCardProviderProps, "headerSlot"> & {
    dashboardText: {
        cardTitle: string;
        headerDescription: string;
    };
};

export function DashboardBingoCardProvider({
    dashboardText,
    ...props
}: DashboardBingoCardProviderProps) {
    const { broadcastCardRefresh, teamName } = useTeamWs();
    const headerSlot = (
        <>
            <div className="flex w-full items-start justify-between gap-4">
                <div className="min-w-0">
                    <CardTitle className="font-headline text-2xl">
                        {dashboardText.cardTitle.replace('{teamName}', teamName)}
                    </CardTitle>
                    <CardDescription>
                        {dashboardText.headerDescription}
                    </CardDescription>
                </div>

                <div className="shrink-0">
                    <BingoCardEditButton />
                </div>
            </div>
        </>
    );

    return (
        <BingoCard
            {...props}
            headerSlot={headerSlot}
            broadcastRefresh={broadcastCardRefresh}
        />
    );
}