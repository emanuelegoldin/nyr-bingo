/**
 * DB tests for the order of the leaderboard.
 * Spec Reference: 12-team-tabs.md - Leaderboard Tab
 */

import { describe, expect, it } from 'vitest';
import { getGameLeaderboard } from '@/lib/db/leaderboard-repository';
import {
  addMember,
  createGame,
  createLeaderboardRow,
  createTeam,
  createUser,
  type GameFixture,
  type UserFixture,
} from '../../support/db/fixtures';
import { execute } from '../../support/db/test-connection';

/** The stored leaderboard values of one player. */
interface Standing {
  username: string;
  firstBingoAt: string | null;
  completedTasks: number;
}

/**
 * Create a game whose players have the given leaderboard values.
 * @param standings One entry per player, in any order
 * @returns The game
 */
const createRankedGame = async (standings: Standing[]): Promise<GameFixture> => {
  const players: UserFixture[] = [];
  for (const standing of standings) {
    players.push(await createUser({ username: standing.username }));
  }
  const team = await createTeam(players[0]);
  for (const player of players.slice(1)) {
    await addMember(team, player);
  }
  const game = await createGame(team, players);
  for (const [index, standing] of standings.entries()) {
    await createLeaderboardRow(game, players[index]);
    await execute('UPDATE team_leaderboard SET first_bingo_at = ?, completed_tasks = ? WHERE game_id = ? AND user_id = ?', [
      standing.firstBingoAt,
      standing.completedTasks,
      game.id,
      players[index].id,
    ]);
  }
  return game;
};

/**
 * Read the leaderboard as usernames, top first.
 * @param game The game
 * @returns The usernames in rank order
 */
const rankedUsernames = async (game: GameFixture): Promise<string[]> =>
  (await getGameLeaderboard(game.id)).map((entry) => entry.username);

describe('leaderboard – ranking', () => {
  it('ranks players with a bingo above players without one, whatever their count (12-team-tabs.md – Leaderboard Tab)', async () => {
    // Arrange
    const game = await createRankedGame([
      { username: 'no_bingo', firstBingoAt: null, completedTasks: 20 },
      { username: 'bingo', firstBingoAt: '2026-01-05 10:00:00', completedTasks: 5 },
    ]);

    // Act
    const order = await rankedUsernames(game);

    // Assert
    expect(order).toEqual(['bingo', 'no_bingo']);
  });

  it('ranks the earlier first bingo higher (12-team-tabs.md – Leaderboard Tab)', async () => {
    // Arrange
    const game = await createRankedGame([
      { username: 'later', firstBingoAt: '2026-01-06 10:00:00', completedTasks: 9 },
      { username: 'earlier', firstBingoAt: '2026-01-05 10:00:00', completedTasks: 5 },
    ]);

    // Act
    const order = await rankedUsernames(game);

    // Assert
    expect(order).toEqual(['earlier', 'later']);
  });

  it('breaks a tie on first bingo by the higher completed count (12-team-tabs.md – Leaderboard Tab)', async () => {
    // Arrange
    const game = await createRankedGame([
      { username: 'fewer', firstBingoAt: null, completedTasks: 2 },
      { username: 'more', firstBingoAt: null, completedTasks: 3 },
    ]);

    // Act
    const order = await rankedUsernames(game);

    // Assert
    expect(order).toEqual(['more', 'fewer']);
  });

  it('breaks a full tie alphabetically by username (12-team-tabs.md – Leaderboard Tab)', async () => {
    // Arrange
    const game = await createRankedGame([
      { username: 'zoe', firstBingoAt: null, completedTasks: 1 },
      { username: 'adam', firstBingoAt: null, completedTasks: 1 },
    ]);

    // Act
    const order = await rankedUsernames(game);

    // Assert
    expect(order).toEqual(['adam', 'zoe']);
  });
});
