/**
 * Members list of the team page.
 * Spec Reference: 04-bingo-teams.md - Team Page
 *
 * Displays a simple list of team members. Each row shows the
 * member's avatar on the left (clickable → profile) and their
 * username in the center. On the team page, leaders get a Make Leader action
 * on every non-leader row (spec 04 - Leaders).
 */

import { ConfirmActionDialog } from "@/components/dialogs/confirm-action-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { TeamMember } from "./types";

interface MembersListProps {
  members: TeamMember[];
  currentUserId: string;
  /** Whether the current user may promote members (spec 21: team.promote). */
  canPromote?: boolean;
  /** Promotes a member to leader. Non-leader rows show Make Leader when `canPromote` is set. */
  onPromote?: (userId: string) => void;
  /** The member being promoted, while the request runs. */
  promotingUserId?: string | null;
}

/**
 * Lists members with their leader badge, and the Make Leader action when `canPromote` and `onPromote` are set.
 *
 * @param props - The members, the current user and the optional promote action.
 * @returns The members card.
 */
export function MembersList({ members, currentUserId, canPromote = false, onPromote, promotingUserId = null }: MembersListProps) {
  const t = useTranslations("Teams");
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">{t("membersList.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {members.map((member) => {
            const isLeader = member.membership.role === "leader";
            const isCurrentUser = member.user.userId === currentUserId;

            return (
              <li
                key={member.user.userId}
                className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
              >
                {/* Clickable avatar → profile page */}
                <Link href={`/profile/${member.user.userId}`}>
                  <Avatar className="cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarFallback>
                      {(member.user.displayName || member.user.username)?.charAt(0) || "?"}
                    </AvatarFallback>
                  </Avatar>
                </Link>

                {/* Username (centered within the row) */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {member.user.displayName || member.user.username}
                    {isCurrentUser && (
                      <span className="text-muted-foreground text-sm ml-1">{t("membersList.you")}</span>
                    )}
                  </p>
                </div>

                {!isLeader && canPromote && onPromote && (
                  <ConfirmActionDialog
                    triggerLabel={t("membersList.makeLeader")}
                    triggerIcon={Crown}
                    triggerVariant="outline"
                    title={t("membersList.makeLeaderTitle", { name: member.user.displayName || member.user.username })}
                    description={t("membersList.makeLeaderDescription")}
                    confirmLabel={t("membersList.makeLeader")}
                    onConfirm={() => onPromote(member.user.userId)}
                    isPending={promotingUserId === member.user.userId}
                  />
                )}

                {/* Leader badge */}
                {isLeader && (
                  <span
                    title={t("membersList.teamLeader")}
                    className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <Crown className="h-4 w-4" />
                    {t("membersList.leader")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
