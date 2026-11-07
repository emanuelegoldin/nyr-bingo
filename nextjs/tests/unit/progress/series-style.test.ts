/**
 * Unit tests for the colour and dash of each player's line.
 * Spec Reference: 23-progress-chart.md - Colours and Legend
 */

import { describe, expect, it } from 'vitest';
import { seriesStyle } from '@/components/progress/series-style';

describe('series style', () => {
  it('gives the first eight players eight different solid colours (23-progress-chart.md – Colours and Legend)', () => {
    // Act
    const styles = Array.from({ length: 8 }, (_, index) => seriesStyle(index));

    // Assert
    expect(new Set(styles.map((style) => style.color)).size).toBe(8);
    expect(styles.every((style) => !style.dashed)).toBe(true);
  });

  it('repeats the colours in order from the ninth player on, with a dashed line (23-progress-chart.md – Colours and Legend)', () => {
    // Act
    const ninth = seriesStyle(8);

    // Assert
    expect(ninth).toEqual({ color: seriesStyle(0).color, dashed: true });
  });
});
