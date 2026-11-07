/**
 * DB tests for adding and changing a reaction on a teammate's stamped cell.
 * Spec Reference: 24-cell-reactions.md - Who Can React, Adding, Changing and Removing, Backend Rules
 *
 * The random placement is not tested.
 */

import { describe, expect, it } from 'vitest';
import { setCellReaction } from '@/lib/db/cell-reaction-repository';
import { CellState } from '@/lib/shared/types';
import { createReaction } from '../../support/db/fixtures';
import { createReactionSetup, readReactions } from './helpers';

describe('reactions – set', () => {
  describe('operations', () => {
    it.each([CellState.COMPLETED, CellState.ACCOMPLISHED])('adds a reaction to a %s cell (24-cell-reactions.md – Who Can React)', async (state) => {
      // Arrange
      const { cellId, teammates } = await createReactionSetup(state);

      // Act
      await setCellReaction(cellId, teammates[0].id, 'fire');

      // Assert
      expect(await readReactions(cellId)).toEqual([{ user_id: teammates[0].id, reaction: 'fire' }]);
    });

    it('replaces the player\'s earlier reaction, keeping one per player (24-cell-reactions.md – Who Can React)', async () => {
      // Arrange
      const { cellId, teammates } = await createReactionSetup();
      await createReaction(cellId, teammates[0], 'heart');

      // Act
      await setCellReaction(cellId, teammates[0].id, 'star');

      // Assert
      expect(await readReactions(cellId)).toEqual([{ user_id: teammates[0].id, reaction: 'star' }]);
    });

    it('keeps the reactions of several teammates on the same cell (24-cell-reactions.md – Who Can React)', async () => {
      // Arrange
      const { cellId, teammates } = await createReactionSetup();
      await createReaction(cellId, teammates[0], 'heart');

      // Act
      await setCellReaction(cellId, teammates[1].id, 'party');

      // Assert
      expect((await readReactions(cellId)).map((row) => row.reaction).sort()).toEqual(['heart', 'party']);
    });
  });

  describe('rejects', () => {
    it.each([CellState.PENDING, CellState.PENDING_REVIEW, CellState.FAILED])(
      'reacting to a %s cell, which is not stamped (24-cell-reactions.md – Backend Rules)',
      async (state) => {
        // Arrange
        const { cellId, teammates } = await createReactionSetup(state);

        // Act
        await setCellReaction(cellId, teammates[0].id, 'fire');

        // Assert
        expect(await readReactions(cellId)).toEqual([]);
      }
    );
  });
});
