/**
 * Unit tests for the permission table: the full set of permissions of each role, and which need a verified email.
 * Spec Reference: 21-authorization.md - Permission Table
 */

import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_ROLE_PERMISSIONS,
  GAME_ROLE_PERMISSIONS,
  GLOBAL_PERMISSIONS,
  TEAM_ROLE_PERMISSIONS,
  VERIFIED_PERMISSIONS,
} from '@/lib/authz/permissions';

/**
 * Sort a permission list, so the comparison ignores order.
 * @param permissions The permissions
 * @returns A sorted copy
 */
const sorted = (permissions: Iterable<string>): string[] => [...permissions].sort();

const GAME_PLAYER = [
  'game.view', 'game.propose', 'game.leave', 'thread.request', 'thread.view',
  'thread.message', 'thread.vote', 'card.arrange', 'cell.react',
];

describe('permission table', () => {
  it('gives every logged-in user team.create and team.join (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(GLOBAL_PERMISSIONS)).toEqual(['team.create', 'team.join']);
  });

  it('gives a team member only team.view and team.leave (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(TEAM_ROLE_PERMISSIONS.member)).toEqual(['team.leave', 'team.view']);
  });

  it('gives a Team Admin the member permissions plus invite, promote, delete and game.create (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(TEAM_ROLE_PERMISSIONS.leader)).toEqual(
      sorted(['team.view', 'team.leave', 'team.invite', 'team.promote', 'team.delete', 'game.create'])
    );
  });

  it('gives a game player the play, thread, arrange and react permissions (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(GAME_ROLE_PERMISSIONS.player)).toEqual(sorted(GAME_PLAYER));
  });

  it('gives a game admin the player permissions plus the management ones (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(GAME_ROLE_PERMISSIONS.leader)).toEqual(
      sorted([...GAME_PLAYER, 'thread.delete', 'game.configure', 'game.start', 'game.end', 'game.delete', 'game.goal.set'])
    );
  });

  it('gives an archived game player only archive.view (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(ARCHIVE_ROLE_PERMISSIONS.player)).toEqual(['archive.view']);
  });

  it('gives an archived game admin archive.view and both deletes (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(ARCHIVE_ROLE_PERMISSIONS.leader)).toEqual(['archive.delete', 'archive.thread.delete', 'archive.view']);
  });

  it('requires a verified email for team.create, team.join, game.create and game.start only (21-authorization.md – Permission Table)', () => {
    // Assert
    expect(sorted(VERIFIED_PERMISSIONS)).toEqual(['game.create', 'game.start', 'team.create', 'team.join']);
  });
});
