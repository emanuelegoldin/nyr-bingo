/**
 * Members Tab — Team Detail Page
 * Spec Reference: 12-team-tabs.md
 *
 * Displays a simple list of all team members. Each row shows the
 * member's avatar on the left (clickable → profile) and their
 * username in the center.
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown } from "lucide-react";
import Link from "next/link";
import type { Team } from "./types";

interface MembersTabProps {
  team: Team;
  currentUserId: string;
}

export function MembersTab({ team, currentUserId }: MembersTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Team Members</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {team.members.map((member) => {
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
                      <span className="text-muted-foreground text-sm ml-1">(You)</span>
                    )}
                  </p>
                </div>

                {/* Leader badge */}
                {isLeader && (
                  <span
                    title="Team Leader"
                    className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <Crown className="h-4 w-4" />
                    Leader
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
