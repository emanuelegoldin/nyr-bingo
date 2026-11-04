/**
 * Capabilities: the permissions a user holds in a team or game, for gating actions on a page.
 * Spec Reference: 21-authorization.md - Client Gating
 *
 * Email verification is not applied: pages show verified-only actions and the API reports
 * the refusal (spec 04 - Verification Requirement).
 */

import type { Game, User } from '@/lib/db/types';
import {
  GAME_ROLE_PERMISSIONS,
  TEAM_ROLE_PERMISSIONS,
  type GamePermission,
  type TeamPermission,
} from './permissions';
import { getGameRole, getTeamRole } from './roles';

/**
 * List the permissions a user holds in a team through their role.
 * @param user The user
 * @param teamId The team
 * @returns The permissions, empty when the user is not a member
 */
export async function getTeamCapabilities(user: User, teamId: string): Promise<TeamPermission[]> {
  const role = await getTeamRole(teamId, user.id);
  return role ? [...TEAM_ROLE_PERMISSIONS[role]] : [];
}

/**
 * List the permissions a user holds in a game through their role.
 * @param user The user
 * @param game The game, already loaded
 * @returns The permissions, empty when the user is not a player
 */
export async function getGameCapabilities(user: User, game: Game): Promise<GamePermission[]> {
  const role = await getGameRole(game.id, user.id);
  return role ? [...GAME_ROLE_PERMISSIONS[role]] : [];
}
