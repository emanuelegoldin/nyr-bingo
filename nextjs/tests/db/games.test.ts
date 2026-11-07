/**
 * DB tests for games: table structure, creation, roster, deadline, start conditions, ending, deletion and leaving.
 * Spec Reference: 16-games.md - Game Model, Game Creation, Game Configuration, Start Conditions, Ending a Game, Deleting a Game, Leaving a Game, Joining After Start
 */

import { describe, expect, it } from 'vitest';
import {
  addPlayerToRunningGames,
  checkGameCanStart,
  createGame,
  deleteGame,
  endGame,
  getRunningGamesForUser,
  setGameDeadline,
} from '@/lib/db/game-repository';
import { leaveGame } from '@/lib/db/leave-repository';
import { GameStatus, TeamRole } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createLeaderboardRow,
  createMemberResolution,
  createTeam as seedTeam,
  createTeamGoal,
  createUser,
  type GameFixture,
} from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { execute, query } from './support/test-connection';

/** The persisted fields of a game that the tests look at. */
interface StoredGame {
  status: GameStatus;
  deadline: string | null;
  grid_size: number;
  started_at: Date | null;
  ended_at: Date | null;
}

/**
 * Read a game straight from the table, bypassing the repository.
 * @param gameId The game
 * @returns The stored fields, with the deadline as YYYY-MM-DD text
 */
const readGame = async (gameId: string): Promise<StoredGame> => {
  const rows = await query<StoredGame[]>(
    'SELECT status, CAST(deadline AS CHAR) AS deadline, grid_size, started_at, ended_at FROM games WHERE id = ?',
    [gameId]
  );
  return rows[0];
};

/**
 * Set a game's deadline to yesterday on the database clock, so it is over.
 * @param game The game
 */
const expireDeadline = async (game: GameFixture): Promise<void> => {
  await execute('UPDATE games SET deadline = CURDATE() - INTERVAL 1 DAY WHERE id = ?', [game.id]);
};

describe('games', () => {
  describe('structure', () => {
    it('has the expected games columns (16-games.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('games');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'status', type: "enum('forming','started','ended')", nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
        { name: 'ended_at', type: 'datetime', nullable: true, generated: false },
        { name: 'deadline', type: 'date', nullable: true, generated: false },
        { name: 'grid_size', type: 'tinyint(4)', nullable: false, generated: false },
        { name: 'started_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });

    it('has the expected game_players columns (16-games.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('game_players');

      // Assert
      expect(columns).toEqual([
        { name: 'game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'joined_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });

  describe('operations', () => {
    it('creates a forming game with its grid size and each player once (16-games.md – Game Creation)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);

      // Act
      const game = await createGame(team.id, 'Spring', [leader.id, member.id, leader.id], 3);

      // Assert
      const stored = await readGame(game.id);
      expect(stored).toMatchObject({ status: GameStatus.FORMING, grid_size: 3, deadline: null, started_at: null });
      expect(await countRows('game_players', 'game_id = ?', [game.id])).toBe(2);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
    });

    it('sets, changes and removes the deadline of a started game (16-games.md – Game Configuration)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader]);
      await setGameDeadline(game.id, '2099-01-31');

      // Act
      const changed = await setGameDeadline(game.id, '2099-12-31');
      const deadlineAfterChange = (await readGame(game.id)).deadline;
      const removed = await setGameDeadline(game.id, null);

      // Assert
      expect(changed).toBe(true);
      expect(deadlineAfterChange).toBe('2099-12-31');
      expect(removed).toBe(true);
      expect((await readGame(game.id)).deadline).toBeNull();
    });

    it('ends a started game and records when (16-games.md – Ending a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader]);

      // Act
      const ended = await endGame(game.id);

      // Assert
      expect(ended).toBe(true);
      const stored = await readGame(game.id);
      expect(stored.status).toBe(GameStatus.ENDED);
      expect(stored.ended_at).not.toBeNull();
    });

    it('allows the start once the goal is set, with member resolutions missing (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member], GameStatus.FORMING);
      await createTeamGoal(game, leader);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: true });
    });

    it('deletes a game with its roster, goal, resolutions and cards, leaving the team and sibling games (16-games.md – Deleting a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member]);
      await createTeamGoal(game, leader);
      await createMemberResolution(game, leader, member);
      await createCard(game, leader, [{}]);
      const sibling = await seedGame(team, [leader]);

      // Act
      await deleteGame(game.id);

      // Assert
      expect(await countRows('games', 'id = ?', [game.id])).toBe(0);
      expect(await countRows('game_players', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('resolutions', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ?', [game.id])).toBe(0);
      expect(await countRows('teams', 'id = ?', [team.id])).toBe(1);
      expect(await countRows('games', 'id = ?', [sibling.id])).toBe(1);
    });

    it('removes a leaving player with their card, leaderboard row and the resolutions written for them (16-games.md – Leaving a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member]);
      await createCard(game, member, [{}]);
      await createLeaderboardRow(game, member);
      const writtenForMember = await createMemberResolution(game, leader, member);
      const writtenByMember = await createMemberResolution(game, member, leader);

      // Act
      const result = await leaveGame({ id: game.id, name: 'Game' }, member.id, false);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
      expect(await countRows('bingo_cards', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
      expect(await countRows('team_leaderboard', 'game_id = ? AND user_id = ?', [game.id, member.id])).toBe(0);
      expect(await countRows('resolutions', 'id = ?', [writtenForMember])).toBe(0);
      expect(await countRows('resolutions', 'id = ?', [writtenByMember])).toBe(1);
      expect(await countRows('team_memberships', 'team_id = ? AND user_id = ?', [team.id, member.id])).toBe(1);
    });

    it('passes the team goal to another admin when its owner leaves (16-games.md – Team Goal)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const otherAdmin = await createUser();
      await addMember(team, otherAdmin, TeamRole.LEADER);
      const game = await seedGame(team, [leader, otherAdmin]);
      const goalId = await createTeamGoal(game, leader);

      // Act
      const result = await leaveGame({ id: game.id, name: 'Game' }, leader.id, true);

      // Assert
      expect(result).toEqual({ success: true });
      const goal = await query<{ owner_user_id: string }[]>('SELECT owner_user_id FROM resolutions WHERE id = ?', [goalId]);
      expect(goal[0].owner_user_id).toBe(otherAdmin.id);
    });

    it('adds a new team member to every running game, not to ended ones (16-games.md – Joining After Start)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const forming = await seedGame(team, [leader], GameStatus.FORMING);
      const started = await seedGame(team, [leader], GameStatus.STARTED);
      const ended = await seedGame(team, [leader], GameStatus.ENDED);
      const joiner = await createUser();
      await addMember(team, joiner);

      // Act
      await addPlayerToRunningGames(team.id, joiner.id);

      // Assert
      const playerOf = async (game: GameFixture): Promise<number> =>
        countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, joiner.id]);
      expect(await playerOf(forming)).toBe(1);
      expect(await playerOf(started)).toBe(1);
      expect(await playerOf(ended)).toBe(0);
    });

    it('lists only the running games the user plays (16-games.md – Listing and Reading Games)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const played = await seedGame(team, [leader, member]);
      await seedGame(team, [leader, member], GameStatus.ENDED);
      await seedGame(team, [leader]);

      // Act
      const games = await getRunningGamesForUser(member.id);

      // Assert
      expect(games.map((game) => game.id)).toEqual([played.id]);
    });
  });

  describe('rejects', () => {
    it('ending a game that has not started (16-games.md – Ending a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.FORMING);

      // Act
      const ended = await endGame(game.id);

      // Assert
      expect(ended).toBe(false);
      expect((await readGame(game.id)).status).toBe(GameStatus.FORMING);
    });

    it('setting the deadline of an ended game (16-games.md – Game Configuration)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.ENDED);

      // Act
      const changed = await setGameDeadline(game.id, '2099-12-31');

      // Assert
      expect(changed).toBe(false);
      expect((await readGame(game.id)).deadline).toBeNull();
    });

    it('starting without a team goal (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.FORMING);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Team resolution must be set before starting' });
    });

    it('starting after the deadline is over (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.FORMING);
      await createTeamGoal(game, leader);
      await expireDeadline(game);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'The game deadline has passed' });
    });

    it('starting a game that is not forming (16-games.md – Start Conditions)', async () => {
      // Arrange
      const leader = await createUser();
      const game = await seedGame(await seedTeam(leader), [leader], GameStatus.STARTED);
      await createTeamGoal(game, leader);

      // Act
      const result = await checkGameCanStart(game.id);

      // Assert
      expect(result).toEqual({ success: false, error: 'Game is not in forming status' });
    });

    it('the only admin of a game leaving it (16-games.md – Leaving a Game)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const member = await createUser();
      await addMember(team, member);
      const game = await seedGame(team, [leader, member]);

      // Act
      const result = await leaveGame({ id: game.id, name: 'Game' }, leader.id, true);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await countRows('game_players', 'game_id = ? AND user_id = ?', [game.id, leader.id])).toBe(1);
    });
  });
});
