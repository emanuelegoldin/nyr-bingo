/**
 * DB tests for the preparation phase: the preparation deadline, players marking themselves ready, and which games
 * are due to start.
 * Spec Reference: 16-games.md - Game Creation, Preparation Phase, Game Configuration
 */

import { describe, expect, it } from 'vitest';
import {
  areAllPlayersReady,
  createGame,
  getGamesDueToStart,
  getReadyPlayerIds,
  isDeadlineBeforePreparation,
  setPlayerReady,
} from '@/lib/db/game-repository';
import { startDueGames } from '@/lib/game-starting';
import { GameStatus } from '@/lib/shared/types';
import {
  addMember,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
  type GameFixture,
  type UserFixture,
} from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute, query } from '../../support/db/test-connection';
import { readGame } from './helpers';

/** A game with its players, the first being the admin. */
interface GameSetup {
  game: GameFixture;
  players: UserFixture[];
}

/**
 * Create a game with a number of players.
 * @param playerCount How many players, the first being the admin
 * @param status The game's status (default forming)
 * @returns The game and its players
 */
const createGameWithPlayers = async (playerCount: number, status = GameStatus.FORMING): Promise<GameSetup> => {
  const players = [await createUser()];
  const team = await seedTeam(players[0]);
  for (let index = 1; index < playerCount; index++) {
    const member = await createUser();
    await addMember(team, member);
    players.push(member);
  }
  return { game: await seedGame(team, players, status), players };
};

/**
 * Move a game's preparation deadline relative to now on the database's UTC clock.
 * @param game The game
 * @param minutesFromNow Minutes from now (negative is past)
 */
const movePreparationDeadline = async (game: GameFixture, minutesFromNow: number): Promise<void> => {
  await execute(
    'UPDATE games SET preparation_deadline = UTC_TIMESTAMP() + INTERVAL ? MINUTE WHERE id = ?',
    [minutesFromNow, game.id]
  );
};

describe('games – preparation phase', () => {
  describe('structure', () => {
    it('stores the preparation deadline given at creation, in UTC, with no player ready (16-games.md – Game Creation)', async () => {
      // Arrange
      const leader = await createUser();
      const team = await seedTeam(leader);
      const preparationDeadline = new Date('2030-01-02T03:04:05.000Z');

      // Act
      const game = await createGame(team.id, 'Spring', [leader.id], 5, preparationDeadline);

      // Assert
      expect(game.preparationDeadline).toBe('2030-01-02T03:04:05.000Z');
      const stored = await query<{ deadline: string }[]>(
        'SELECT CAST(preparation_deadline AS CHAR) AS deadline FROM games WHERE id = ?',
        [game.id]
      );
      expect(stored[0].deadline).toBe('2030-01-02 03:04:05');
      expect(await countRows('game_players', 'game_id = ? AND ready_at IS NOT NULL', [game.id])).toBe(0);
    });
  });

  describe('operations', () => {
    it('marks a player ready and lists them as ready (16-games.md – Ready)', async () => {
      // Arrange
      const { game, players } = await createGameWithPlayers(2);

      // Act
      const changed = await setPlayerReady(game.id, players[1].id, true);

      // Assert
      expect(changed).toBe(true);
      expect(await getReadyPlayerIds(game.id)).toEqual([players[1].id]);
      expect(await areAllPlayersReady(game.id)).toBe(false);
    });

    it('lets a ready player become not ready again (16-games.md – Ready)', async () => {
      // Arrange
      const { game, players } = await createGameWithPlayers(1);
      await setPlayerReady(game.id, players[0].id, true);

      // Act
      const changed = await setPlayerReady(game.id, players[0].id, false);

      // Assert
      expect(changed).toBe(true);
      expect(await getReadyPlayerIds(game.id)).toEqual([]);
    });

    it('reports a game whose players are all ready (16-games.md – Automatic Start)', async () => {
      // Arrange
      const { game, players } = await createGameWithPlayers(2);
      for (const player of players) {
        await setPlayerReady(game.id, player.id, true);
      }

      // Act
      const allReady = await areAllPlayersReady(game.id);

      // Assert
      expect(allReady).toBe(true);
    });

    it('lists a forming game as due once its preparation deadline has passed, or once all its players are ready (16-games.md – Automatic Start)', async () => {
      // Arrange
      const expired = await createGameWithPlayers(1);
      await movePreparationDeadline(expired.game, -1);
      const allReady = await createGameWithPlayers(1);
      await setPlayerReady(allReady.game.id, allReady.players[0].id, true);
      const notDue = await createGameWithPlayers(2);
      await setPlayerReady(notDue.game.id, notDue.players[0].id, true);
      const started = await createGameWithPlayers(1, GameStatus.STARTED);
      await movePreparationDeadline(started.game, -1);

      // Act
      const dueIds = (await getGamesDueToStart()).map((game) => game.id);

      // Assert
      expect(dueIds).toContain(expired.game.id);
      expect(dueIds).toContain(allReady.game.id);
      expect(dueIds).not.toContain(notDue.game.id);
      expect(dueIds).not.toContain(started.game.id);
    });

    it('starts every due game, with a card for each player, and leaves the others forming (16-games.md – Automatic Start)', async () => {
      // Arrange
      const due = await createGameWithPlayers(2);
      await movePreparationDeadline(due.game, -1);
      const notDue = await createGameWithPlayers(1);

      // Act
      await startDueGames();

      // Assert
      expect((await readGame(due.game.id)).status).toBe(GameStatus.STARTED);
      expect(await countRows('bingo_cards', 'game_id = ?', [due.game.id])).toBe(2);
      expect(await countRows('team_leaderboard', 'game_id = ?', [due.game.id])).toBe(2);
      expect((await readGame(notDue.game.id)).status).toBe(GameStatus.FORMING);
    });

    it('accepts a game deadline on the date of the preparation deadline (16-games.md – Game Configuration)', async () => {
      // Arrange
      const { game } = await createGameWithPlayers(1);
      await execute("UPDATE games SET preparation_deadline = '2030-03-10 22:00:00' WHERE id = ?", [game.id]);

      // Act
      const before = await isDeadlineBeforePreparation(game.id, '2030-03-10');

      // Assert
      expect(before).toBe(false);
    });
  });

  describe('rejects', () => {
    it('marking a player ready once the game has started (16-games.md – Ready)', async () => {
      // Arrange
      const { game, players } = await createGameWithPlayers(1, GameStatus.STARTED);

      // Act
      const changed = await setPlayerReady(game.id, players[0].id, true);

      // Assert
      expect(changed).toBe(false);
      expect(await countRows('game_players', 'game_id = ? AND ready_at IS NOT NULL', [game.id])).toBe(0);
    });

    it('marking ready a user who does not play the game (16-games.md – Ready)', async () => {
      // Arrange
      const { game } = await createGameWithPlayers(1);
      const stranger = await createUser();

      // Act
      const changed = await setPlayerReady(game.id, stranger.id, true);

      // Assert
      expect(changed).toBe(false);
    });

    it('a game deadline before the date of the preparation deadline (16-games.md – Game Configuration)', async () => {
      // Arrange
      const { game } = await createGameWithPlayers(1);
      await execute("UPDATE games SET preparation_deadline = '2030-03-10 00:30:00' WHERE id = ?", [game.id]);

      // Act
      const before = await isDeadlineBeforePreparation(game.id, '2030-03-09');

      // Assert
      expect(before).toBe(true);
    });
  });
});
