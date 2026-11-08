/**
 * Route tests for creating a game: name, card size, players and preparation deadline.
 * Spec Reference: 16-games.md - Game Creation
 */

import { describe, expect, it } from 'vitest';
import { POST as createGame } from '@/app/api/teams/[teamId]/games/route';
import { addMember, createTeam, createUser, type TeamFixture, type UserFixture } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import { callRoute } from '../../support/api/call-route';
import { signInAs } from '../../support/api/session';

/**
 * Build a team of an admin and two members, and log in the admin.
 * @returns The team and its users
 */
const signInAsAdmin = async (): Promise<{ team: TeamFixture; admin: UserFixture; members: UserFixture[] }> => {
  const admin = await createUser();
  const team = await createTeam(admin);
  const members = [await createUser(), await createUser()];
  for (const member of members) {
    await addMember(team, member);
  }
  await signInAs(admin);
  return { team, admin, members };
};

/**
 * Read the players of the team's only game.
 * @param team The team
 * @returns The player ids, sorted
 */
const readPlayerIds = async (team: TeamFixture): Promise<string[]> => {
  const rows = await query<{ user_id: string }[]>(
    'SELECT p.user_id FROM game_players p JOIN games g ON g.id = p.game_id WHERE g.team_id = ? ORDER BY p.user_id',
    [team.id]
  );
  return rows.map((row) => row.user_id);
};

/** A preparation deadline one day ahead, as the dialog sends it. */
const tomorrow = (): string => new Date(Date.now() + 86_400_000).toISOString();

describe('games – create', () => {
  describe('operations', () => {
    it('creates a 5×5 game when no card size is given (16-games.md – Game Creation)', async () => {
      // Arrange
      const { team } = await signInAsAdmin();

      // Act
      const result = await callRoute(createGame, { method: 'POST', body: { name: 'Spring', preparationDeadline: tomorrow() }, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(201);
      expect(await countRows('games', "team_id = ? AND grid_size = 5 AND status = 'forming'", [team.id])).toBe(1);
    });

    it('makes every member a player when no players are chosen (16-games.md – Game Creation)', async () => {
      // Arrange
      const { team, admin, members } = await signInAsAdmin();

      // Act
      await callRoute(createGame, { method: 'POST', body: { name: 'Spring', preparationDeadline: tomorrow() }, params: { teamId: team.id } });

      // Assert
      expect(await readPlayerIds(team)).toEqual([admin.id, ...members.map((member) => member.id)].sort());
    });

    it('always makes the creator a player (16-games.md – Game Creation)', async () => {
      // Arrange
      const { team, admin, members } = await signInAsAdmin();

      // Act
      await callRoute(createGame, { method: 'POST', body: { name: 'Spring', playerIds: [members[0].id], preparationDeadline: tomorrow() }, params: { teamId: team.id } });

      // Assert
      expect(await readPlayerIds(team)).toEqual([admin.id, members[0].id].sort());
    });

    it('stores the preparation deadline in UTC (16-games.md – Game Creation)', async () => {
      // Arrange
      const { team } = await signInAsAdmin();
      const preparationDeadline = '2099-06-01T09:30:00.000Z';

      // Act
      const result = await callRoute(createGame, { method: 'POST', body: { name: 'Spring', preparationDeadline }, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(201);
      const rows = await query<{ deadline: string }[]>(
        'SELECT CAST(preparation_deadline AS CHAR) AS deadline FROM games WHERE team_id = ?',
        [team.id]
      );
      expect(rows).toEqual([{ deadline: '2099-06-01 09:30:00' }]);
    });
  });

  describe('rejects', () => {
    it('a missing name, with 400 (16-games.md – Game Creation)', async () => {
      // Arrange
      const { team } = await signInAsAdmin();

      // Act
      const result = await callRoute(createGame, { method: 'POST', body: { name: '  ', preparationDeadline: tomorrow() }, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
    });

    it.each([4, 7, '5'])('a card size of %s, with 400 (16-games.md – Game Creation)', async (gridSize) => {
      // Arrange
      const { team } = await signInAsAdmin();

      // Act
      const result = await callRoute(createGame, { method: 'POST', body: { name: 'Spring', gridSize, preparationDeadline: tomorrow() }, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
    });

    it.each([
      { case: 'missing', preparationDeadline: undefined },
      { case: 'not a date-time', preparationDeadline: 'next week' },
      { case: 'without a time zone', preparationDeadline: '2099-06-01T09:30' },
      { case: 'in the past', preparationDeadline: '2020-01-01T00:00:00.000Z' },
    ])('a preparation deadline that is $case, with 400 (16-games.md – Game Creation)', async ({ preparationDeadline }) => {
      // Arrange
      const { team } = await signInAsAdmin();

      // Act
      const result = await callRoute(createGame, { method: 'POST', body: { name: 'Spring', preparationDeadline }, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
    });

    it('a player who is not a member of the team, with 400 (16-games.md – Game Creation)', async () => {
      // Arrange
      const { team } = await signInAsAdmin();
      const outsider = await createUser();

      // Act
      const result = await callRoute(createGame, { method: 'POST', body: { name: 'Spring', playerIds: [outsider.id], preparationDeadline: tomorrow() }, params: { teamId: team.id } });

      // Assert
      expect(result.status).toBe(400);
      expect(await countRows('games', 'team_id = ?', [team.id])).toBe(0);
    });
  });
});
