/**
 * Permission table: which role holds which permission in each scope.
 * Spec Reference: 21-authorization.md - Scopes and Roles, Permission Table
 *
 * Every role lists its full set of permissions; there is no inheritance between roles.
 * Adding a role means adding one entry to the map of its scope.
 */

/** Role of a user in a team (`team_memberships.role`). */
export type TeamScopeRole = 'leader' | 'member';

/** Role of a user in a running game: a player who leads the game's team is `leader`. */
export type GameScopeRole = 'leader' | 'player';

/** Role of a user in an archived game (`archived_game_players.is_leader`). */
export type ArchiveScopeRole = 'leader' | 'player';

/** Any role, in any scope. */
export type ScopeRole = TeamScopeRole | GameScopeRole | ArchiveScopeRole;

/** Permissions open to any logged-in user, with no scope. */
export type GlobalPermission = 'team.create' | 'team.join';

/** Permissions held through a role in a team. */
export type TeamPermission =
  | 'team.view'
  | 'team.leave'
  | 'team.invite'
  | 'team.promote'
  | 'team.delete'
  | 'game.create';

/** Permissions held through a role in a running game. */
export type GamePermission =
  | 'game.view'
  | 'game.propose'
  | 'game.leave'
  | 'thread.request'
  | 'thread.view'
  | 'thread.message'
  | 'thread.vote'
  | 'thread.delete'
  | 'card.arrange'
  | 'game.configure'
  | 'game.start'
  | 'game.end'
  | 'game.delete'
  | 'game.goal.set';

/** Permissions held through a role in an archived game. */
export type ArchivePermission = 'archive.view' | 'archive.delete';

/** Every permission. */
export type Permission = GlobalPermission | TeamPermission | GamePermission | ArchivePermission;

/** Permissions every logged-in user holds. */
export const GLOBAL_PERMISSIONS: readonly GlobalPermission[] = ['team.create', 'team.join'];

/** Permissions of each team role. */
export const TEAM_ROLE_PERMISSIONS: Record<TeamScopeRole, readonly TeamPermission[]> = {
  leader: ['team.view', 'team.leave', 'team.invite', 'team.promote', 'team.delete', 'game.create'],
  member: ['team.view', 'team.leave'],
};

/** Permissions of each game role. */
export const GAME_ROLE_PERMISSIONS: Record<GameScopeRole, readonly GamePermission[]> = {
  leader: [
    'game.view',
    'game.propose',
    'game.leave',
    'thread.request',
    'thread.view',
    'thread.message',
    'thread.vote',
    'thread.delete',
    'card.arrange',
    'game.configure',
    'game.start',
    'game.end',
    'game.delete',
    'game.goal.set',
  ],
  player: [
    'game.view',
    'game.propose',
    'game.leave',
    'thread.request',
    'thread.view',
    'thread.message',
    'thread.vote',
    'card.arrange',
  ],
};

/** Permissions of each archive role. */
export const ARCHIVE_ROLE_PERMISSIONS: Record<ArchiveScopeRole, readonly ArchivePermission[]> = {
  leader: ['archive.view', 'archive.delete'],
  player: ['archive.view'],
};

/** Permissions that also require a verified email (spec 01). */
export const VERIFIED_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  'team.create',
  'team.join',
  'game.create',
  'game.start',
]);
