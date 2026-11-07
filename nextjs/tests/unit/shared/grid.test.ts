/**
 * Unit tests for the card sizes a game may use and the position of the Joker.
 * Spec Reference: 16-games.md - Game Creation; 05-bingo-card-generation.md - Assumptions
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_GRID_SIZE, getJokerPosition, isGridSize } from '@/lib/shared/types';

describe('grid', () => {
  it.each([3, 5, 9])('accepts %i as a card size (16-games.md – Game Creation)', (size) => {
    // Act
    const result = isGridSize(size);

    // Assert
    expect(result).toBe(true);
  });

  it.each([0, 4, 7, 25, '5', null])('rejects %s as a card size (16-games.md – Game Creation)', (size) => {
    // Act
    const result = isGridSize(size);

    // Assert
    expect(result).toBe(false);
  });

  it('defaults to a 5×5 card (16-games.md – Game Creation)', () => {
    // Assert
    expect(DEFAULT_GRID_SIZE).toBe(5);
  });

  it.each([
    [3, 4],
    [5, 12],
    [9, 40],
  ])('puts the Joker of a %i×%i card at the center, position %i (05-bingo-card-generation.md – Assumptions)', (size, position) => {
    // Act
    const result = getJokerPosition(size);

    // Assert
    expect(result).toBe(position);
  });
});
