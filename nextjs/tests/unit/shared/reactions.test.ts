/**
 * Unit tests for the reaction pool and the cell states that can hold a reaction.
 * Spec Reference: 24-cell-reactions.md - Reaction Pool, Who Can React
 */

import { describe, expect, it } from 'vitest';
import { isReactionId, REACTABLE_CELL_STATES, REACTION_IDS } from '@/lib/shared/reactions';
import { CellState } from '@/lib/shared/types';

describe('reactions', () => {
  it('has the fixed pool of six reactions (24-cell-reactions.md – Reaction Pool)', () => {
    // Assert
    expect([...REACTION_IDS]).toEqual(['heart', 'thumbs_up', 'fire', 'star', 'smile', 'party']);
  });

  it.each([...REACTION_IDS])('accepts %s from the pool (24-cell-reactions.md – Reaction Pool)', (id) => {
    // Act
    const result = isReactionId(id);

    // Assert
    expect(result).toBe(true);
  });

  it.each(['thumbs_down', 'HEART', '', 1, null])('rejects %s, which is not in the pool (24-cell-reactions.md – Reaction Pool)', (value) => {
    // Act
    const result = isReactionId(value);

    // Assert
    expect(result).toBe(false);
  });

  it('only stamped cells, completed or accomplished, can hold a reaction (24-cell-reactions.md – Who Can React)', () => {
    // Assert
    expect([...REACTABLE_CELL_STATES].sort()).toEqual([CellState.ACCOMPLISHED, CellState.COMPLETED]);
  });
});
