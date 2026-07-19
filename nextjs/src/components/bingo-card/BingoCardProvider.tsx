"use client"; // required for useState, useEffect, etc.

import { BingoCardWithCells } from "@/lib/db/types";
import { Card, CardHeader } from "@ui/card";
import { createContext, useMemo, useState } from "react";
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
    headerSlot?: React.ReactNode;
    children?: React.ReactNode;
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
        setEditMode: () => { }
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
        headerSlot
    }: BaseBingoCardProviderProps
) {
    // BAD! Overwriting the state with setState causes too many re-renders
    // if (user) {
    //     setState({ ...state, user });
    // }
    // Use useEffect to update the state when the user prop changes
    // TODO: User is part of the context (it won't be mutated by bingo card); 
    //       resolutions can be mutated by user actions ==> part of the state
    //       update function provided by context to update state from child components
    //
    // const [state, setState] = useState(() => ({
    //     ...BingoCard.initialState,
    //     user: user ?? BingoCard.initialState.user
    // }));
    //
    // useEffect(() => {
    //     if (user) {
    //         setState((current) => ({
    //         ...current,
    //         user,
    //         }));
    //     }
    //     }, [user]);
    const [state, setState] = useState(BingoCard.initialState);
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
            {/* This creates new object for the context value on every render! {**{here the new obj}**} */}
            {/* <BingoCardContext value={{ user: user, actions: { update: setState } }}> */}
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
                    />
                </BingoCard.Frame>
            </BingoCardContext>
        </BingoCard.Provider>
    )
}

BingoCard.initialState = {

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
    const headerSlot = (
        <>
            <ProfileInfo isCurrentUser={props.isOwner} />
        </>
    );

    return (
        <BingoCard
            {...props}
            headerSlot={headerSlot}
        />
    );
}

export function DashboardBingoCardProvider(props: Omit<BaseBingoCardProviderProps, 'headerSlot'>) {
    const headerSlot = (
        <>
            <BingoCardEditButton />
        </>
    );

    return (
        <BingoCard
            {...props}
            headerSlot={headerSlot}
        />
    );
}