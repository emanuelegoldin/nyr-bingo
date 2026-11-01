/**
 * Shared types for the team page, the game page and their components.
 * Spec Reference: 04-bingo-teams.md
 */

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
  leaderUserId: string;
  members: TeamMember[];
}
