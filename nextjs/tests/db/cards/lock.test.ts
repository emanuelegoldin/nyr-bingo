/**
 * DB tests for locking a card and the cases where a card can no longer be shuffled.
 * Spec Reference: 22-card-shuffle.md - Lock, Shuffle, Permissions & Safety
 *
 * The random arrangement a shuffle produces is not tested.
 */

import { describe, expect, it } from 'vitest';
import { lockBingoCard, shuffleBingoCard } from '@/lib/db/bingo-card-arrangement';
import { CellState, GameStatus } from '@/lib/shared/types';
import { createPlayingCard, createUser } from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

/**
 * Read a card's lock time as text, to compare it exactly.
 * @param cardId The card
 * @returns The lock time, or null while unlocked
 */
const readLockedAt = async (cardId: string): Promise<string | null> => {
  const rows = await query<{ locked_at: string | null }[]>('SELECT CAST(locked_at AS CHAR) AS locked_at FROM bingo_cards WHERE id = ?', [cardId]);
  return rows[0].locked_at;
};

/**
 * Read the positions of a card's cells, by cell id.
 * @param cardId The card
 * @returns The positions, ordered by cell id
 */
const readPositions = async (cardId: string): Promise<{ id: string; position: number }[]> =>
  query<{ id: string; position: number }[]>('SELECT id, position FROM bingo_cells WHERE card_id = ? ORDER BY id', [cardId]);

describe('cards – lock', () => {
  describe('operations', () => {
    it('locks an unlocked card (22-card-shuffle.md – Lock)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{}, {}]);

      // Act
      const result = await lockBingoCard(game.id, owner.id);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await readLockedAt(card.id)).not.toBeNull();
    });

    it('locks a card whatever the state of its cells (22-card-shuffle.md – Lock)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{ state: CellState.COMPLETED }, { state: CellState.PENDING_REVIEW }]);

      // Act
      const result = await lockBingoCard(game.id, owner.id);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await readLockedAt(card.id)).not.toBeNull();
    });

    it('keeps the first lock time when a locked card is locked again (22-card-shuffle.md – Backend Rules)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{}]);
      await execute("UPDATE bingo_cards SET locked_at = '2026-01-02 03:04:05' WHERE id = ?", [card.id]);

      // Act
      const result = await lockBingoCard(game.id, owner.id);

      // Assert
      expect(result).toEqual({ success: true });
      expect(await readLockedAt(card.id)).toBe('2026-01-02 03:04:05');
    });
  });

  describe('rejects', () => {
    it('shuffling a locked card, leaving every cell in place (22-card-shuffle.md – Permissions & Safety)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{}, {}, {}]);
      await execute('UPDATE bingo_cards SET locked_at = NOW() WHERE id = ?', [card.id]);
      const before = await readPositions(card.id);

      // Act
      const result = await shuffleBingoCard(game.id, owner.id);

      // Assert
      expect(result).toMatchObject({ success: false, status: 400 });
      expect(await readPositions(card.id)).toEqual(before);
    });

    it.each([CellState.COMPLETED, CellState.PENDING_REVIEW, CellState.ACCOMPLISHED])(
      'shuffling a card with a %s cell, leaving every cell in place (22-card-shuffle.md – Shuffle)',
      async (state) => {
        // Arrange
        const { owner, game, card } = await createPlayingCard([{}, { state }, {}]);
        const before = await readPositions(card.id);

        // Act
        const result = await shuffleBingoCard(game.id, owner.id);

        // Assert
        expect(result).toMatchObject({ success: false, status: 400 });
        expect(await readPositions(card.id)).toEqual(before);
      }
    );

    it.each([
      ['locking', lockBingoCard],
      ['shuffling', shuffleBingoCard],
    ])('%s without a card in the game (22-card-shuffle.md – Permissions & Safety)', async (_action, arrange) => {
      // Arrange
      const { game } = await createPlayingCard([{}]);
      const cardless = await createUser();

      // Act
      const result = await arrange(game.id, cardless.id);

      // Assert
      expect(result).toMatchObject({ success: false, status: 404 });
    });

    it('locking a card of an ended game (22-card-shuffle.md – Permissions & Safety)', async () => {
      // Arrange
      const { owner, game, card } = await createPlayingCard([{}], GameStatus.ENDED);

      // Act
      const result = await lockBingoCard(game.id, owner.id);

      // Assert
      expect(result).toMatchObject({ success: false, status: 404 });
      expect(await readLockedAt(card.id)).toBeNull();
    });
  });
});
