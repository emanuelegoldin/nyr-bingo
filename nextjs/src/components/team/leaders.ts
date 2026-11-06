/**
 * Helpers for the Team Admins of a team or game: the members whose stored role is leader.
 * Spec Reference: 04-bingo-teams.md - Admins, 16-games.md - Game Model
 */

import type { TeamMember } from "./types";

/**
 * Join the names of the leaders in a member list.
 * @param members - Team members, or a game's players
 * @param unknownLabel - Text returned when there is no leader (translated by the caller)
 * @returns The display names (or usernames) of the leaders, comma-separated, or `unknownLabel`
 */
export const formatLeaderNames = (members: TeamMember[], unknownLabel: string): string => {
  const names = members
    .filter((member) => member.membership.role === "leader")
    .map((member) => member.user.displayName || member.user.username);
  return names.length > 0 ? names.join(", ") : unknownLabel;
};
