/**
 * DB tests for bingo_cells: table structure, state and content changes, and rejected writes.
 * Spec Reference: 06-bingo-gameplay.md - Cell States, 05-bingo-card-generation.md - Data Model Notes, 09-bingo-card-editing.md - Persisting a Cell Edit
 */

import { describe, expect, it } from 'vitest';
import { undoCompletion, updateCellContent, updateCellState } from '@/lib/db/bingo-cell-repository';
import { CellSourceType, CellState, GameStatus, ResolutionType } from '@/lib/shared/types';
import { createPersonalResolution, createPlayingCard } from './support/fixtures';
import { getColumns } from './support/schema';
import { query } from './support/test-connection';

/** The persisted fields of a cell that the tests look at. */
interface StoredCell {
  state: CellState;
  source_type: CellSourceType;
  resolution_id: string | null;
  title: string | null;
  is_empty: number;
}

/**
 * Read a cell straight from the table, bypassing the repository.
 * @param cellId The cell
 * @returns The stored fields
 */
const readCell = async (cellId: string): Promise<StoredCell> => {
  const rows = await query<StoredCell[]>(
    'SELECT state, source_type, resolution_id, title, is_empty FROM bingo_cells WHERE id = ?',
    [cellId]
  );
  return rows[0];
};

describe('bingo_cells', () => {
  describe('structure', () => {
    it('has the expected columns (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Act
      const columns = await getColumns('bingo_cells');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'card_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'position', type: 'int(11)', nullable: false, generated: false },
        {
          name: 'source_type',
          type: "enum('team','member_provided','personal','empty','prepared')",
          nullable: false,
          generated: false,
        },
        { name: 'source_user_id', type: 'varchar(36)', nullable: true, generated: false },
        {
          name: 'state',
          type: "enum('pending','completed','pending_review','accomplished','failed')",
          nullable: true,
          generated: false,
        },
        { name: 'created_at', type: 'datetime', nullable: true, generated: false },
        { name: 'updated_at', type: 'datetime', nullable: true, generated: false },
        { name: 'resolution_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'resolution_type', type: "enum('base','compound','iterative')", nullable: false, generated: false },
        { name: 'title', type: 'varchar(255)', nullable: true, generated: false },
        { name: 'description', type: 'text', nullable: true, generated: false },
        { name: 'number_of_repetition', type: 'int(11)', nullable: true, generated: false },
        { name: 'completed_times', type: 'int(11)', nullable: false, generated: false },
        { name: 'is_empty', type: 'tinyint(1)', nullable: true, generated: true },
      ]);
    });

    it('derives is_empty from source_type (05-bingo-card-generation.md – Data Model Notes)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ source: 'empty' }, { source: 'personal' }]);
      const [emptyCellId, personalCellId] = card.cellIds;

      // Act
      const emptyCell = await readCell(emptyCellId);
      const personalCell = await readCell(personalCellId);

      // Assert
      expect(emptyCell.is_empty).toBe(1);
      expect(personalCell.is_empty).toBe(0);
    });
  });

  describe('operations', () => {
    it('marks a pending base cell completed (06-bingo-gameplay.md – Mark Resolution as Completed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result).toMatchObject({ success: true, cell: { id: cellId, state: CellState.COMPLETED } });
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('marks a failed base cell completed (06-bingo-gameplay.md – Mark Resolution as Completed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.FAILED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result.success).toBe(true);
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('marks a pending cell of any type failed (06-bingo-gameplay.md – Mark Resolution as Failed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.COMPOUND }, { type: ResolutionType.ITERATIVE }]);
      const [compoundCellId, iterativeCellId] = card.cellIds;

      // Act
      const compoundResult = await updateCellState(compoundCellId, CellState.FAILED);
      const iterativeResult = await updateCellState(iterativeCellId, CellState.FAILED);

      // Assert
      expect(compoundResult.success).toBe(true);
      expect(iterativeResult.success).toBe(true);
      expect((await readCell(compoundCellId)).state).toBe(CellState.FAILED);
      expect((await readCell(iterativeCellId)).state).toBe(CellState.FAILED);
    });

    it('undoes a completed base cell back to pending (06-bingo-gameplay.md – Undo Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await undoCompletion(cellId);

      // Assert
      expect(result.success).toBe(true);
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it('undoes a failed cell back to pending (06-bingo-gameplay.md – Undo Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ type: ResolutionType.ITERATIVE, state: CellState.FAILED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await undoCompletion(cellId);

      // Assert
      expect(result.success).toBe(true);
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it('replaces a cell with a personal resolution and resets its state (09-bingo-card-editing.md – Persisting a Cell Edit)', async () => {
      // Arrange
      const { owner, card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;
      const resolutionId = await createPersonalResolution(owner, 'Read twelve books');

      // Act
      const result = await updateCellContent(cellId, { resolutionId, sourceType: CellSourceType.PERSONAL });

      // Assert
      expect(result.success).toBe(true);
      expect(await readCell(cellId)).toEqual({
        state: CellState.PENDING,
        source_type: CellSourceType.PERSONAL,
        resolution_id: resolutionId,
        title: 'Read twelve books',
        is_empty: 0,
      });
    });

    it('empties a cell and clears its snapshot (09-bingo-card-editing.md – Persisting a Cell Edit)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellContent(cellId, { resolutionId: null, sourceType: CellSourceType.EMPTY });

      // Assert
      expect(result.success).toBe(true);
      expect(await readCell(cellId)).toEqual({
        state: CellState.PENDING,
        source_type: CellSourceType.EMPTY,
        resolution_id: null,
        title: null,
        is_empty: 1,
      });
    });
  });

  describe('rejects', () => {
    it('completing an empty cell (06-bingo-gameplay.md – Non-Checkable Cells)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ source: 'empty' }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result).toEqual({ success: false, error: 'Empty cells cannot be marked as completed' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it.each([ResolutionType.COMPOUND, ResolutionType.ITERATIVE])(
      'completing a %s cell manually (06-bingo-gameplay.md – Automatic Completion)',
      async (type) => {
        // Arrange
        const { card } = await createPlayingCard([{ type }]);
        const [cellId] = card.cellIds;

        // Act
        const result = await updateCellState(cellId, CellState.COMPLETED);

        // Assert
        expect(result).toEqual({ success: false, error: 'Compound and iterative cells complete automatically' });
        expect((await readCell(cellId)).state).toBe(CellState.PENDING);
      }
    );

    it('failing an empty cell (06-bingo-gameplay.md – Non-Checkable Cells)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ source: 'empty' }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.FAILED);

      // Assert
      expect(result).toEqual({ success: false, error: 'Empty cells cannot be marked as failed' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it('setting a review state directly (06-bingo-gameplay.md – Cell States)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.ACCOMPLISHED);

      // Assert
      expect(result).toEqual({ success: false, error: 'Only pending, completed and failed can be set directly' });
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('failing a completed cell before undoing it (06-bingo-gameplay.md – Mark Resolution as Failed)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{ state: CellState.COMPLETED }]);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.FAILED);

      // Assert
      expect(result.success).toBe(false);
      expect((await readCell(cellId)).state).toBe(CellState.COMPLETED);
    });

    it('undoing a pending cell (06-bingo-gameplay.md – Undo Completion)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}]);
      const [cellId] = card.cellIds;

      // Act
      const result = await undoCompletion(cellId);

      // Assert
      expect(result).toEqual({ success: false, error: 'Cell is not completed' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });

    it('changing a cell of an ended game (16-games.md – Ending a Game)', async () => {
      // Arrange
      const { card } = await createPlayingCard([{}], GameStatus.ENDED);
      const [cellId] = card.cellIds;

      // Act
      const result = await updateCellState(cellId, CellState.COMPLETED);

      // Assert
      expect(result).toEqual({ success: false, error: 'This game has ended' });
      expect((await readCell(cellId)).state).toBe(CellState.PENDING);
    });
  });
});
