/**
 * Helpers for the leaders of a team or game: the members whose role is leader.
 * Spec Reference: 04-bingo-teams.md - Leaders, 16-games.md - Game Model
 */

import type { TeamMember } from "./types";

/**
 * Check whether a user is one of the leaders in a member list.
 * @param members - Team members, or a game's players
 * @param userId - The user to check
 * @returns True if the user is listed with the leader role
 */
export const isLeaderIn = (members: TeamMember[], userId: string | null | undefined): boolean =>
  members.some((member) => member.membership.userId === userId && member.membership.role === "leader");

/**
 * Join the names of the leaders in a member list.
 * @param members - Team members, or a game's players
 * @returns The display names (or usernames) of the leaders, comma-separated, or "Unknown"
 */
export const formatLeaderNames = (members: TeamMember[]): string => {
  const names = members
    .filter((member) => member.membership.role === "leader")
    .map((member) => member.user.displayName || member.user.username);
  return names.length > 0 ? names.join(", ") : "Unknown";
};
