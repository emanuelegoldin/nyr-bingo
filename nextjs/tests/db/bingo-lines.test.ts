/**
 * DB tests for bingo line detection: which lines score, which cells count as done, the first-bingo time
 * stored on the leaderboard, and the bingo notification.
 * Spec Reference: 12-team-tabs.md - Bingo detection logic, 19-notifications.md - Events
 */

import { describe, expect, it } from 'vitest';
import { refreshLeaderboardEntry } from '@/lib/db/leaderboard-repository';
import { CellState, GameStatus, type GridSize } from '@/lib/shared/types';
import {
  createCard,
  createGame as seedGame,
  createLeaderboardRow,
  createTeam as seedTeam,
  createUser,
  type CellFixtureInput,
  type GameFixture,
  type UserFixture,
} from './support/fixtures';
import { countRows } from './support/rows';
import { execute, query } from './support/test-connection';

/** A player with a card in a started game, and a leaderboard row with no bingo. */
interface BingoSetup {
  player: UserFixture;
  game: GameFixture;
  cellIds: string[];
}

/**
 * Build a started game of one player whose card holds the given cells.
 * @param gridSize The side length of the card
 * @param cells The stored cells, each at its own position
 * @returns The player, the game and the cell ids in the order given
 */
const createBingoCard = async (gridSize: GridSize, cells: CellFixtureInput[]): Promise<BingoSetup> => {
  const player = await createUser();
  const game = await seedGame(await seedTeam(player), [player], GameStatus.STARTED, gridSize);
  const card = await createCard(game, player, cells);
  await createLeaderboardRow(game, player);
  return { player, game, cellIds: card.cellIds };
};

/**
 * Cells in one state at the given positions.
 * @param positions The positions
 * @param state The state of every cell (default completed)
 * @returns The cell inputs
 */
const cellsAt = (positions: number[], state: CellState = CellState.COMPLETED): CellFixtureInput[] =>
  positions.map((position) => ({ position, state }));

/**
 * Read the stored first-bingo time of a player.
 * @param setup The player and game
 * @returns The time as 'YYYY-MM-DD hh:mm:ss', or null without a bingo
 */
const readFirstBingoAt = async ({ game, player }: BingoSetup): Promise<string | null> => {
  const rows = await query<{ first_bingo_at: string | null }[]>(
    'SELECT CAST(first_bingo_at AS CHAR) AS first_bingo_at FROM team_leaderboard WHERE game_id = ? AND user_id = ?',
    [game.id, player.id]
  );
  return rows[0].first_bingo_at;
};

describe('bingo lines', () => {
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

    it('publishes one bingo event and drops it while still pending when the bingo is lost (19-notifications.md – Cancellation)', async () => {
      // Arrange
      const setup = await createBingoCard(3, cellsAt([2, 6]));
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);
      const eventsAfterBingo = await countRows('notification_events', "type = 'bingo_scored' AND game_id = ?", [setup.game.id]);
      await execute("UPDATE bingo_cells SET state = 'pending' WHERE id = ?", [setup.cellIds[0]]);

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(eventsAfterBingo).toBe(1);
      expect(await countRows('notification_events', "type = 'bingo_scored' AND game_id = ?", [setup.game.id])).toBe(0);
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
