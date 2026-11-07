/**
 * DB tests for removing one's reaction from a cell.
 * Spec Reference: 24-cell-reactions.md - Adding, Changing and Removing
 */

import { describe, expect, it } from 'vitest';
import { removeCellReaction } from '@/lib/db/cell-reaction-repository';
import { createReaction } from '../../support/db/fixtures';
import { createReactionSetup, readReactions } from './helpers';

describe('reactions – remove', () => {
  it('removes only the caller\'s reaction (24-cell-reactions.md – Adding, Changing and Removing)', async () => {
    // Arrange
    const { cellId, teammates } = await createReactionSetup();
    await createReaction(cellId, teammates[0], 'heart');
    await createReaction(cellId, teammates[1], 'fire');

    // Act
    await removeCellReaction(cellId, teammates[0].id);

    // Assert
    expect(await readReactions(cellId)).toEqual([{ user_id: teammates[1].id, reaction: 'fire' }]);
  });

  it('succeeds and changes nothing when there is no reaction to remove (24-cell-reactions.md – Adding, Changing and Removing)', async () => {
    // Arrange
    const { cellId, teammates } = await createReactionSetup();
    await createReaction(cellId, teammates[1], 'fire');

    // Act
    const removal = removeCellReaction(cellId, teammates[0].id);

    // Assert
    await expect(removal).resolves.toBe(false);
    expect(await readReactions(cellId)).toHaveLength(1);
  });
});
