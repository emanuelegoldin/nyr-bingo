/**
 * DB tests for recording a progress point when the completed count changes.
 * Spec Reference: 23-progress-chart.md - Recording Progress
 */

import { describe, expect, it } from 'vitest';
import { autoTransitionCellState } from '@/lib/db/bingo-cell-repository';
import { refreshLeaderboardEntry } from '@/lib/db/leaderboard-repository';
import { ResolutionType } from '@/lib/shared/types';
import { createLeaderboardRow, createPlayingCard } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';

describe('leaderboard – progress points', () => {
  describe('operations', () => {
    it('records a progress point when the completed count changes (23-progress-chart.md – Recording Progress)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }]);
      await createLeaderboardRow(game, owner);

      // Act
      await autoTransitionCellState(card.cellIds[0], true);

      // Assert
      const points = await query<{ completed_tasks: number }[]>(
        'SELECT completed_tasks FROM leaderboard_progress WHERE game_id = ? AND user_id = ?',
        [game.id, owner.id]
      );
      expect(points).toEqual([{ completed_tasks: 1 }]);
      const board = await query<{ completed_tasks: number }[]>(
        'SELECT completed_tasks FROM team_leaderboard WHERE game_id = ? AND user_id = ?',
        [game.id, owner.id]
      );
      expect(board[0].completed_tasks).toBe(1);
    });

    it('stores no progress point when the count is unchanged (23-progress-chart.md – Recording Progress)', async () => {
      // Arrange
      const { owner, game } = await createPlayingCard([{}]);
      await createLeaderboardRow(game, owner);

      // Act
      await refreshLeaderboardEntry(game.id, owner.id);

      // Assert
      expect(await countRows('leaderboard_progress', 'game_id = ?', [game.id])).toBe(0);
    });
  });
});
