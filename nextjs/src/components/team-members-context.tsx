"use client";

/**
 * TeamMembersContext
 *
 * Provides a userId → username mapping so that child components
 * (e.g. ResolutionCell) can resolve display names without issuing
 * individual HTTP requests.
 *
 * The context is populated once at the team-page level from data
 * that is already fetched as part of the game page payload.
 */

import { createContext, useContext } from "react";

/** Map of userId → username. */
export type TeamMembersMap = Record<string, string>;

const TeamMembersContext = createContext<TeamMembersMap>({});

export function TeamMembersProvider({
  members,
  children,
}: {
  members: TeamMembersMap;
  children: React.ReactNode;
}) {
  return (
    <TeamMembersContext.Provider value={members}>
      {children}
    </TeamMembersContext.Provider>
  );
}

/** Retrieve the userId → username map provided by TeamMembersProvider. */
export function useTeamMembers(): TeamMembersMap {
  return useContext(TeamMembersContext);
}
