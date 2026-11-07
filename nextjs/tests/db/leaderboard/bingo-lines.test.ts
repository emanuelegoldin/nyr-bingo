/**
 * DB tests for detecting a bingo line and storing the first bingo time.
 * Spec Reference: 12-team-tabs.md - Bingo detection logic
 */

import { describe, expect, it } from 'vitest';
import { refreshLeaderboardEntry } from '@/lib/db/leaderboard-repository';
import { CellState } from '@/lib/shared/types';
import { execute } from '../../support/db/test-connection';
import { createBingoCard, cellsAt, readFirstBingoAt } from './helpers';

describe('leaderboard – bingo lines', () => {
  describe('operations', () => {
    it.each([
      ['the middle row, through the Joker', [10, 11, 13, 14]],
      ['a column that misses the Joker', [0, 5, 10, 15, 20]],
      ['the main diagonal', [0, 6, 18, 24]],
      ['the anti-diagonal', [4, 8, 16, 20]],
    ])('scores %s on a 5×5 card (12-team-tabs.md – Bingo detection logic)', async (_line, positions) => {
      // Arrange
      const setup = await createBingoCard(5, cellsAt(positions));

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).not.toBeNull();
    });

    it('scores a line of 3 on a 3×3 card, with the Joker at 4 (12-team-tabs.md – Bingo detection logic)', async () => {
      // Arrange
      const setup = await createBingoCard(3, cellsAt([2, 6]));

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).not.toBeNull();
    });

    it('counts accomplished cells as done (12-team-tabs.md – Bingo detection logic)', async () => {
      // Arrange
      const setup = await createBingoCard(5, [
        ...cellsAt([10, 11], CellState.ACCOMPLISHED),
        ...cellsAt([13, 14], CellState.COMPLETED),
      ]);

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).not.toBeNull();
    });

    it('stores the latest update of the earliest completed line (12-team-tabs.md – Bingo detection logic)', async () => {
      // Arrange: row 0 (0, 1, 2) completes at 10:05; column 2 (2, 5, 8) and the diagonal (0, Joker, 8) at 11:00
      const setup = await createBingoCard(3, [
        { position: 0, state: CellState.COMPLETED, updatedAt: '2026-01-01 09:00:00' },
        { position: 1, state: CellState.COMPLETED, updatedAt: '2026-01-01 10:05:00' },
        { position: 2, state: CellState.COMPLETED, updatedAt: '2026-01-01 09:30:00' },
        { position: 5, state: CellState.COMPLETED, updatedAt: '2026-01-01 08:00:00' },
        { position: 8, state: CellState.COMPLETED, updatedAt: '2026-01-01 11:00:00' },
      ]);

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).toBe('2026-01-01 10:05:00');
    });

    it('clears the first-bingo time when the line is undone (12-team-tabs.md – Bingo detection logic)', async () => {
      // Arrange
      const setup = await createBingoCard(3, cellsAt([2, 6]));
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);
      await execute("UPDATE bingo_cells SET state = 'pending' WHERE id = ?", [setup.cellIds[0]]);

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).toBeNull();
    });
  });

  describe('rejects', () => {
    it('a line with one cell missing (12-team-tabs.md – Bingo detection logic)', async () => {
      // Arrange
      const setup = await createBingoCard(5, cellsAt([0, 1, 2, 3]));

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).toBeNull();
    });

    it.each([CellState.PENDING, CellState.PENDING_REVIEW, CellState.FAILED])(
      'a line with a %s cell (12-team-tabs.md – Bingo detection logic)',
      async (state) => {
        // Arrange
        const setup = await createBingoCard(3, [...cellsAt([0, 1]), ...cellsAt([2], state)]);

        // Act
        await refreshLeaderboardEntry(setup.game.id, setup.player.id);

        // Assert
        expect(await readFirstBingoAt(setup)).toBeNull();
      }
    );

    it('a line with an empty cell (06-bingo-gameplay.md – Non-Checkable Cells)', async () => {
      // Arrange
      const setup = await createBingoCard(3, [...cellsAt([0, 1]), { position: 2, source: 'empty' }]);

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).toBeNull();
    });

    it('a wrapped "line" across the edge of the card (12-team-tabs.md – Bingo detection logic)', async () => {
      // Arrange: positions 3, 4 and 5 run from the end of row 0 into row 1 on a 5×5 card, plus 6 and 7
      const setup = await createBingoCard(5, cellsAt([3, 4, 5, 6, 7]));

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(await readFirstBingoAt(setup)).toBeNull();
    });
  });
});
