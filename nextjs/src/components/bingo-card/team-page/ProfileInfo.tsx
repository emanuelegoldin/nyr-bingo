import { Avatar, AvatarFallback } from "@ui/avatar"
import { CardTitle } from "@ui/card"
import Link from "next/dist/client/link"
import { useContext } from "react"
import { BingoCardContext } from "../BingoCardProvider"

export function ProfileInfo({ isCurrentUser }: { isCurrentUser: boolean }) {
    return (
        <ProfileInfo.Provider>
            <ProfileInfo.Icon />
            <ProfileInfo.Name isCurrentUser={isCurrentUser} />
        </ProfileInfo.Provider>
    )
}

// --------------------------------------
// -- Implementation of compoents part --
// --------------------------------------

ProfileInfo.Provider = function ({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center space-x-4">
            {children}
        </div>
    )
}

// Copied from team page. TODO: extract component
ProfileInfo.Icon = function () {
    const context = useContext(BingoCardContext);
    if (!context) {
        throw new Error("ProfileInfo.Icon must be used within a BingoCardProvider");
    }
    const { id, username } = context.user;

    return (
        <Link href={`/profile/${id}`}>
            <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarFallback>
                    {username?.charAt(0) || "?"}
                </AvatarFallback>
            </Avatar>
        </Link>
    )
}

ProfileInfo.Name = function ({ isCurrentUser }: { isCurrentUser: boolean }) {
    const context = useContext(BingoCardContext);
    if (!context) {
        throw new Error("ProfileInfo.Name must be used within a BingoCardProvider");
    }
    const { username } = context.user;

    return (
        <CardTitle className="font-headline text-xl">
            <div className="text-lg font-semibold">{username} {isCurrentUser && " (You)"}</div>
        </CardTitle>
    )
}