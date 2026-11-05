import { Avatar, AvatarFallback } from "@ui/avatar";
import { CardTitle } from "@ui/card";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useContext } from "react";
import { BingoCardContext } from "../BingoCardProvider";

/**
 * Avatar and name of the card's owner, linking to their profile.
 *
 * @param props - Whether the owner is the viewer, which adds "(You)".
 * @returns The profile header.
 */
export function ProfileInfo({ isCurrentUser }: { isCurrentUser: boolean }) {
  const t = useTranslations("Dashboard");
  const { id, username } = useContext(BingoCardContext).user;

  return (
    <div className="flex items-center space-x-4">
      <Link href={`/profile/${id}`}>
        <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarFallback>
            {username?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
      </Link>
      <CardTitle className="font-headline text-xl">
        <div className="text-lg font-semibold">{username} {isCurrentUser && ` ${t("you")}`}</div>
      </CardTitle>
    </div>
  );
}
