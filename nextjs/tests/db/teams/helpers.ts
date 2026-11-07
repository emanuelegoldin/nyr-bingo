/**
 * Helpers shared by the teams DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { TeamRole } from '@/lib/shared/types';
import { query } from '../../support/db/test-connection';

/**
 * Read a user's stored role in a team.
 * @param teamId The team
 * @param userId The user
 * @returns The role, or undefined when the user is not a member
 */
export const readRole = async (teamId: string, userId: string): Promise<TeamRole | undefined> => {
  const rows = await query<{ role: TeamRole }[]>(
    'SELECT role FROM team_memberships WHERE team_id = ? AND user_id = ?',
    [teamId, userId]
  );
  return rows[0]?.role;
};
