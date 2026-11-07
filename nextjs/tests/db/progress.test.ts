/**
 * DB tests for progress: cell subtasks and counters, automatic completion, progress points and cell history.
 * Spec Reference: 06-bingo-gameplay.md - Automatic Completion, 23-progress-chart.md - Recording Progress, 13-resolution-history-and-progress.md - Manual Entry Creation
 */

import { describe, expect, it } from 'vitest';
import { autoTransitionCellState } from '@/lib/db/bingo-cell-repository';
import { createManualCellHistoryEntry } from '@/lib/db/cell-history-repository';
import { adjustCellIterativeProgress, toggleCellSubtask } from '@/lib/db/cell-progress-repository';
import { refreshLeaderboardEntry } from '@/lib/db/leaderboard-repository';
import { CellState, GameStatus, ResolutionType } from '@/lib/shared/types';
import { createLeaderboardRow, createPlayingCard } from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { query } from './support/test-connection';

/**
 * Read a cell's state straight from the table.
 * @param cellId The cell
 * @returns The stored state
 */
const readState = async (cellId: string): Promise<CellState> => {
  const rows = await query<{ state: CellState }[]>('SELECT state FROM bingo_cells WHERE id = ?', [cellId]);
  return rows[0].state;
};

/**
 * Read the completed flags of a cell's subtasks, in order.
 * @param cellId The cell
 * @returns 0 or 1 per subtask
 */
const readSubtaskFlags = async (cellId: string): Promise<number[]> => {
  const rows = await query<{ completed: number }[]>(
    'SELECT completed FROM bingo_cell_subtasks WHERE cell_id = ? ORDER BY subtask_index',
    [cellId]
  );
  return rows.map((row) => Number(row.completed));
};

/**
 * Read a cell's iterative counter.
 * @param cellId The cell
 * @returns completed_times
 */
const readCounter = async (cellId: string): Promise<number> => {
  const rows = await query<{ completed_times: number }[]>('SELECT completed_times FROM bingo_cells WHERE id = ?', [cellId]);
  return rows[0].completed_times;
};

describe('progress', () => {
  describe('structure', () => {
    it('has the expected leaderboard_progress columns (23-progress-chart.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('leaderboard_progress');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'bigint(20)', nullable: false, generated: false },
        { name: 'game_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'recorded_at', type: 'datetime', nullable: false, generated: false },
        { name: 'completed_tasks', type: 'int(11)', nullable: false, generated: false },
      ]);
    });

    it('has the expected cell_history_entries columns (13-resolution-history-and-progress.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('cell_history_entries');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'cell_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'author_user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'entry_type', type: "enum('manual_note','system_event')", nullable: false, generated: false },
        { name: 'event_key', type: 'varchar(120)', nullable: true, generated: false },
        { name: 'content', type: 'text', nullable: false, generated: false },
        { name: 'metadata_json', type: 'longtext', nullable: true, generated: false },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });
  });

  describe('operations', () => {
    it('toggles one subtask of a compound cell (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }]);
      const [cellId] = card.cellIds;

      // Act
      const toggled = await toggleCellSubtask(cellId, 1);

      // Assert
      expect(toggled).toBe(true);
      expect(await readSubtaskFlags(cellId)).toEqual([0, 1]);
    });

    it('moves the counter of an iterative cell and never below zero (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE }]);
      const [cellId] = card.cellIds;

      // Act
      await adjustCellIterativeProgress(cellId, 1);
      await adjustCellIterativeProgress(cellId, 1);
      const afterIncrements = await readCounter(cellId);
      await adjustCellIterativeProgress(cellId, -1);
      await adjustCellIterativeProgress(cellId, -1);
      await adjustCellIterativeProgress(cellId, -1);

      // Assert
      expect(afterIncrements).toBe(2);
      expect(await readCounter(cellId)).toBe(0);
    });

    it.each([CellState.PENDING, CellState.FAILED])(
      'completes a %s cell whose progress is complete (06-bingo-gameplay.md – Automatic Completion)',
      async (state) => {
        // Arrange
        const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND, state }]);
        const [cellId] = card.cellIds;

        // Act
        const changed = await autoTransitionCellState(cellId, true);

        // Assert
        expect(changed).toHaveLength(1);
        expect(await readState(cellId)).toBe(CellState.COMPLETED);
      }
    );

    it('reverts a completed cell whose progress is no longer complete (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE, state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      await autoTransitionCellState(cellId, false);

      // Assert
      expect(await readState(cellId)).toBe(CellState.PENDING);
    });

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

    it('adds a trimmed manual note to a cell\'s history (13-resolution-history-and-progress.md – Manual Entry Creation)', async () => {
      // Arrange
      const { owner, card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const entry = await createManualCellHistoryEntry(cellId, owner.id, '  Ran 5 km  ');

      // Assert
      const rows = await query<{ entry_type: string; content: string }[]>(
        'SELECT entry_type, content FROM cell_history_entries WHERE id = ?',
        [entry.id]
      );
      expect(rows).toEqual([{ entry_type: 'manual_note', content: 'Ran 5 km' }]);
    });
  });

  describe('rejects', () => {
    it('toggling a subtask the cell does not have (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }]);
      const [cellId] = card.cellIds;

      // Act
      const toggled = await toggleCellSubtask(cellId, 5);

      // Assert
      expect(toggled).toBe(false);
      expect(await readSubtaskFlags(cellId)).toEqual([0, 0]);
    });

    it('reverting a failed cell whose progress is incomplete (06-bingo-gameplay.md – Automatic Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND, state: CellState.FAILED }]);
      const [cellId] = card.cellIds;

      // Act
      const changed = await autoTransitionCellState(cellId, false);

      // Assert
      expect(changed).toEqual([]);
      expect(await readState(cellId)).toBe(CellState.FAILED);
    });

    it.each([CellState.PENDING_REVIEW, CellState.ACCOMPLISHED])(
      'changing a %s cell automatically (06-bingo-gameplay.md – Automatic Completion)',
      async (state) => {
        // Arrange
        const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE, state }]);
        const [cellId] = card.cellIds;

        // Act
        const changed = await autoTransitionCellState(cellId, false);

        // Assert
        expect(changed).toEqual([]);
        expect(await readState(cellId)).toBe(state);
      }
    );

    it('completing a cell of an ended game automatically (16-games.md – Ending a Game)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }], GameStatus.ENDED);
      const [cellId] = card.cellIds;

      // Act
      const changed = await autoTransitionCellState(cellId, true);

      // Assert
      expect(changed).toEqual([]);
      expect(await readState(cellId)).toBe(CellState.PENDING);
    });

    it('an empty history note (13-resolution-history-and-progress.md – Manual Entry Creation)', async () => {
      // Arrange
      const { owner, card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const attempt = createManualCellHistoryEntry(cellId, owner.id, '   ');

      // Assert
      await expect(attempt).rejects.toThrow('History content must be non-empty');
      expect(await countRows('cell_history_entries', 'cell_id = ?', [cellId])).toBe(0);
    });
  });
});
