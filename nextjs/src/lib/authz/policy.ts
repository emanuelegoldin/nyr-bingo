/**
 * Authorization policy: decide whether a user holds a permission on a target.
 * Spec Reference: 21-authorization.md - Permission Table, Status Rules
 */

import type { Game, User } from '@/lib/db/types';
import {
  ARCHIVE_ROLE_PERMISSIONS,
  GAME_ROLE_PERMISSIONS,
  GLOBAL_PERMISSIONS,
  TEAM_ROLE_PERMISSIONS,
  VERIFIED_PERMISSIONS,
  type ArchivePermission,
  type GamePermission,
  type GlobalPermission,
  type Permission,
  type ScopeRole,
  type TeamPermission,
} from './permissions';
import { getArchiveRole, getGameRole, getTeamRole } from './roles';

/** No scope: the permission is open to any logged-in user. */
export type NoTarget = { scope: 'none' };

/** A team. A missing team is not looked up: the caller has no role in it. */
export type TeamTarget = { scope: 'team'; teamId: string };

/**
 * A game, already loaded by the caller. `null` means it was not found and gives `404`.
 * Routes pass the result of `getRunningGame`, so an ended game is not found.
 */
export type GameTarget = { scope: 'game'; game: Game | null };

/** An archived game. The caller checks that it exists. */
export type ArchiveTarget = { scope: 'archive'; archivedGameId: string };

/** Any authorization target. A future app-wide scope is added as one more member. */
export type AuthzTarget = NoTarget | TeamTarget | GameTarget | ArchiveTarget;

/** The target type a permission is checked against. */
export type TargetFor<P extends Permission> =
  P extends GlobalPermission ? NoTarget
    : P extends TeamPermission ? TeamTarget
      : P extends GamePermission ? GameTarget
        : P extends ArchivePermission ? ArchiveTarget
          : never;

/** Outcome of an authorization check. `role` is null for a permission with no scope. */
export type AuthzDecision =
  | { allowed: true; role: ScopeRole | null }
  | { allowed: false; status: 403 | 404; error: string };

/** What a verified-only permission is for, completing "Please verify your email before …". */
const VERIFIED_ACTIONS: Partial<Record<Permission, string>> = {
  'team.create': 'creating a team',
  'team.join': 'joining a team',
  'game.create': 'creating a game',
  'game.start': 'starting a game',
};

/** Error when a role lacks a leader permission. */
const LEADER_ONLY_ERRORS: Partial<Record<Permission, string>> = {
  'team.invite': 'Only a Team Admin can invite users',
  'team.promote': 'Only a Team Admin can promote members',
  'team.delete': 'Only a Team Admin can delete the team',
  'game.create': 'Only a Team Admin can create a game',
  'game.configure': 'Only a Team Admin playing the game can configure it',
  'game.start': 'Only a Team Admin playing the game can start it',
  'game.end': 'Only a Team Admin playing the game can end it',
  'game.delete': 'Only a Team Admin playing the game can delete it',
  'game.goal.set': 'Only a Team Admin playing the game can set the team goal',
  'archive.delete': 'Only a Team Admin playing the game can delete it',
};

/** Error when the user has no role in the target's scope. */
const NO_ROLE_ERRORS: Record<Exclude<AuthzTarget['scope'], 'none'>, string> = {
  team: 'You are not a member of this team',
  game: 'You are not a player of this game',
  archive: 'You did not take part in this game',
};

/**
 * Build a refusal.
 * @param status The HTTP status
 * @param error The message
 * @returns The refused decision
 */
function deny(status: 403 | 404, error: string): AuthzDecision {
  return { allowed: false, status, error };
}

/**
 * Look up the user's role in a target and the permissions that role holds.
 * @param user The user
 * @param target The target, whose game (if any) is already known to exist
 * @returns The role and its permissions, or null when the user has no role there
 */
async function resolveRole(
  user: User,
  target: Exclude<AuthzTarget, NoTarget>
): Promise<{ role: ScopeRole; permissions: readonly Permission[] } | null> {
  switch (target.scope) {
    case 'team': {
      const role = await getTeamRole(target.teamId, user.id);
      return role ? { role, permissions: TEAM_ROLE_PERMISSIONS[role] } : null;
    }
    case 'game': {
      const role = target.game ? await getGameRole(target.game.id, user.id) : null;
      return role ? { role, permissions: GAME_ROLE_PERMISSIONS[role] } : null;
    }
    case 'archive': {
      const role = await getArchiveRole(target.archivedGameId, user.id);
      return role ? { role, permissions: ARCHIVE_ROLE_PERMISSIONS[role] } : null;
    }
  }
}

/**
 * Decide whether a user holds a permission on a target. Checks run in the order of spec 21:
 * verified email, resource found, role, permission.
 * @param user The logged-in user
 * @param permission The permission asked for
 * @param target The team, game or archived game it applies to, or no scope
 * @returns Allowed with the user's role, or refused with the HTTP status and message
 */
export async function authorize<P extends Permission>(
  user: User,
  permission: P,
  target: TargetFor<P>
): Promise<AuthzDecision> {
  const scopedTarget: AuthzTarget = target;

  if (VERIFIED_PERMISSIONS.has(permission) && user.emailVerifiedAt === null) {
    const action = VERIFIED_ACTIONS[permission] ?? 'continuing';
    return deny(403, `Email verification required. Please verify your email before ${action}.`);
  }

  if (scopedTarget.scope === 'none') {
    return (GLOBAL_PERMISSIONS as readonly Permission[]).includes(permission)
      ? { allowed: true, role: null }
      : deny(403, 'You do not have permission to do this');
  }

  if (scopedTarget.scope === 'game' && !scopedTarget.game) {
    return deny(404, 'Game not found');
  }

  const resolved = await resolveRole(user, scopedTarget);
  if (!resolved) {
    return deny(403, NO_ROLE_ERRORS[scopedTarget.scope]);
  }
  if (!resolved.permissions.includes(permission)) {
    return deny(403, LEADER_ONLY_ERRORS[permission] ?? 'You do not have permission to do this');
  }
  return { allowed: true, role: resolved.role };
}

