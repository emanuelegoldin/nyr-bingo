/**
 * Helpers for the leaders of a team or game: the members whose role is leader.
 * Spec Reference: 04-bingo-teams.md - Leaders, 16-games.md - Game Model
 */

import type { TeamMember } from "./types";

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
