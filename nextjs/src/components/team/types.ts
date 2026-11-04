/**
 * Shared types for the team page, the game page and their components.
 * Spec Reference: 04-bingo-teams.md
 */

import type { TeamMemberWithProfile } from "@/lib/db/types";
import { toIsoDateString } from "@/lib/shared/dates";

/** Team member shape as returned by the team and game APIs. */
export interface TeamMember {
  membership: {
    id: string;
    teamId: string;
    userId: string;
    role: "leader" | "member";
    joinedAt: string;
  };
  user: {
    id: string;
    userId: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
  };
}

/** Team shape as returned by the team API. */
export interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

/**
 * Converts a server team member into the serializable shape passed to client components.
 *
 * @param member - Team member with membership and public profile.
 * @returns The member with its join date as an ISO string.
 */
export const toTeamMember = (member: TeamMemberWithProfile): TeamMember => ({
  membership: {
    id: member.membership.id,
    teamId: member.membership.teamId,
    userId: member.membership.userId,
    role: member.membership.role,
    joinedAt: toIsoDateString(member.membership.joinedAt),
  },
  user: {
    id: member.user.id,
    userId: member.user.userId,
    username: member.user.username,
    displayName: member.user.displayName,
    bio: member.user.bio,
    avatarUrl: member.user.avatarUrl,
  },
});
