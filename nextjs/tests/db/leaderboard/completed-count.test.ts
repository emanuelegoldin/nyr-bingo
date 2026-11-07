/**
 * DB tests for the completed count stored on the leaderboard.
 * Spec Reference: 12-team-tabs.md - Database Impact
 */

import { describe, expect, it } from 'vitest';
import { refreshLeaderboardEntry } from '@/lib/db/leaderboard-repository';
import { CellState } from '@/lib/shared/types';
import { createLeaderboardRow, createPlayingCard } from '../../support/db/fixtures';
import { query } from '../../support/db/test-connection';

describe('leaderboard – completed count', () => {
  it('counts completed and accomplished cells only (12-team-tabs.md – Database Impact)', async () => {
    // Arrange
    const { owner, game } = await createPlayingCard([
      { state: CellState.COMPLETED },
      { state: CellState.ACCOMPLISHED },
      { state: CellState.PENDING_REVIEW },
      { state: CellState.FAILED },
      { state: CellState.PENDING },
    ]);
    await createLeaderboardRow(game, owner);

    // Act
    await refreshLeaderboardEntry(game.id, owner.id);

    // Assert
    const rows = await query<{ completed_tasks: number }[]>(
      'SELECT completed_tasks FROM team_leaderboard WHERE game_id = ? AND user_id = ?',
      [game.id, owner.id]
    );
    expect(rows).toEqual([{ completed_tasks: 2 }]);
  });
});
