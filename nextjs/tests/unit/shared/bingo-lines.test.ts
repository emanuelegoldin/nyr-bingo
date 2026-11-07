/**
 * Unit tests for the bingo lines of a card: which positions form a line and when a line is complete.
 * Spec Reference: 12-team-tabs.md - Bingo detection logic
 */

import { describe, expect, it } from 'vitest';
import { getBingoLines, hasBingoLine } from '@/lib/shared/bingo-lines';

describe('bingo lines', () => {
  it.each([3, 5, 9])('a %i×%i card has its rows, columns and two diagonals as lines (12-team-tabs.md – Bingo detection logic)', (gridSize) => {
    // Act
    const lines = getBingoLines(gridSize);

    // Assert
    expect(lines).toHaveLength(2 * gridSize + 2);
    expect(lines.every((line) => line.length === gridSize)).toBe(true);
  });

  it('a 3×3 card has the expected lines (12-team-tabs.md – Bingo detection logic)', () => {
    // Act
    const lines = getBingoLines(3);

    // Assert
    expect(lines).toEqual([
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ]);
  });

  it('a line through the Joker is complete without the Joker being done (12-team-tabs.md – Bingo detection logic)', () => {
    // Arrange
    const middleRowWithoutJoker = new Set([10, 11, 13, 14]);

    // Act
    const result = hasBingoLine(5, middleRowWithoutJoker);

    // Assert
    expect(result).toBe(true);
  });

  it('a line with one cell missing is not complete (12-team-tabs.md – Bingo detection logic)', () => {
    // Arrange
    const firstRowMinusOne = new Set([0, 1, 2, 3]);

    // Act
    const result = hasBingoLine(5, firstRowMinusOne);

    // Assert
    expect(result).toBe(false);
  });

  it('cells that wrap across the edge of the card are not a line (12-team-tabs.md – Bingo detection logic)', () => {
    // Arrange: end of row 0 and start of row 1 on a 3×3 card, plus the Joker in between
    const wrapped = new Set([2, 3]);

    // Act
    const result = hasBingoLine(3, wrapped);

    // Assert
    expect(result).toBe(false);
  });
});
