/**
 * DB tests for the leaderboard rows and progress points every player gets when a game starts.
 * Spec Reference: 12-team-tabs.md - When rows are written; 23-progress-chart.md - Recording Progress
 */

import { describe, expect, it } from 'vitest';
import { initializeGameLeaderboard } from '@/lib/db/leaderboard-repository';
import { addMember, createGame, createTeam, createUser } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

/**
 * Create a started game with two players and a known start time.
 * @returns The game and its player ids
 */
const createStartedGame = async () => {
  const [admin, member] = [await createUser(), await createUser()];
  const team = await createTeam(admin);
  await addMember(team, member);
  const game = await createGame(team, [admin, member]);
  await execute("UPDATE games SET started_at = '2026-01-10 09:00:00' WHERE id = ?", [game.id]);
  return { game, playerIds: [admin.id, member.id].sort() };
};

describe('games – initial leaderboard', () => {
  it('gives every player a row with no bingo and nothing completed (12-team-tabs.md – When rows are written)', async () => {
    // Arrange
    const { game, playerIds } = await createStartedGame();

    // Act
    await initializeGameLeaderboard(game, playerIds);

    // Assert
    const rows = await query<{ user_id: string; first_bingo_at: Date | null; completed_tasks: number }[]>(
      'SELECT user_id, first_bingo_at, completed_tasks FROM team_leaderboard WHERE game_id = ? ORDER BY user_id',
      [game.id]
    );
    expect(rows).toEqual(playerIds.map((user_id) => ({ user_id, first_bingo_at: null, completed_tasks: 0 })));
  });

  it('gives every player a progress point of 0 at the start time (23-progress-chart.md – Recording Progress)', async () => {
    // Arrange
    const { game, playerIds } = await createStartedGame();

    // Act
    await initializeGameLeaderboard(game, playerIds);

    // Assert
    const points = await query<{ user_id: string; recorded_at: string; completed_tasks: number }[]>(
      'SELECT user_id, CAST(recorded_at AS CHAR) AS recorded_at, completed_tasks FROM leaderboard_progress WHERE game_id = ? ORDER BY user_id',
      [game.id]
    );
    expect(points).toEqual(playerIds.map((user_id) => ({ user_id, recorded_at: '2026-01-10 09:00:00', completed_tasks: 0 })));
  });
});
