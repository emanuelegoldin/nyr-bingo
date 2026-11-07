/**
 * Route tests for the actions that need a verified email.
 * Spec Reference: 01-authentication.md - Verification-Based Access Control; 21-authorization.md - Permission Table
 */

import { describe, expect, it } from 'vitest';
import { POST as startGame } from '@/app/api/games/[gameId]/start/route';
import { POST as joinTeam } from '@/app/api/join/route';
import { POST as createGame } from '@/app/api/teams/[teamId]/games/route';
import { POST as createTeam } from '@/app/api/teams/route';
import { GameStatus } from '@/lib/shared/types';
import {
  createGame as seedGame,
  createInvitation,
  createTeam as seedTeam,
  createTeamGoal,
  createUser,
  type UserFixture,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

/**
 * Remove a user's verification and log them in.
 * @param user The user
 */
const signInUnverified = async (user: UserFixture): Promise<void> => {
  await execute('UPDATE users SET email_verified_at = NULL WHERE id = ?', [user.id]);
  await signInAs(user);
};

describe('auth – verification required', () => {
  it('refuses an unverified user creating a team, with 403 (01-authentication.md – Verification-Based Access Control)', async () => {
    // Arrange
    const user = await createUser();
    await signInUnverified(user);

    // Act
    const result = await callRoute(createTeam, { method: 'POST', body: { name: 'Runners' } });

    // Assert
    expect(result.status).toBe(403);
    expect(await countRows('teams', 'name = ?', ['Runners'])).toBe(0);
  });

  it('refuses an unverified user joining a team, with 403 (01-authentication.md – Verification-Based Access Control)', async () => {
    // Arrange
    const admin = await createUser();
    const team = await seedTeam(admin);
    const inviteCode = await createInvitation(team);
    const user = await createUser();
    await signInUnverified(user);

    // Act
    const result = await callRoute(joinTeam, { method: 'POST', body: { inviteCode } });

    // Assert
    expect(result.status).toBe(403);
    expect(await countRows('team_memberships', 'team_id = ? AND user_id = ?', [team.id, user.id])).toBe(0);
  });

  it('refuses an unverified Team Admin creating a game, with 403 (21-authorization.md – Permission Table)', async () => {
    // Arrange
    const admin = await createUser();
    const team = await seedTeam(admin);
    await signInUnverified(admin);

    // Act
    const result = await callRoute(createGame, { method: 'POST', body: { name: 'Spring' }, params: { teamId: team.id } });

    // Assert
    expect(result.status).toBe(403);
    expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
  });

  it('refuses an unverified Team Admin starting a game, with 403 (21-authorization.md – Permission Table)', async () => {
    // Arrange
    const admin = await createUser();
    const game = await seedGame(await seedTeam(admin), [admin], GameStatus.FORMING);
    await createTeamGoal(game, admin);
    await signInUnverified(admin);

    // Act
    const result = await callRoute(startGame, { method: 'POST', params: { gameId: game.id } });

    // Assert
    expect(result.status).toBe(403);
    expect(await countRows('games', "id = ? AND status = 'forming'", [game.id])).toBe(1);
  });
});
