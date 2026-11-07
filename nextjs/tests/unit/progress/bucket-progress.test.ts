/**
 * Unit tests for turning progress points into one value per player per day or month.
 * Spec Reference: 23-progress-chart.md - Chart
 */

import { describe, expect, it } from 'vitest';
import { bucketProgress } from '@/components/progress/bucket-progress';
import type { ProgressData } from '@/components/progress/types';

/**
 * An ISO datetime for a local calendar time, so the tests hold in any time zone.
 * @param month 1-based month of 2026
 * @param day Day of the month
 * @param hour Local hour
 * @returns The ISO datetime
 */
const local = (month: number, day: number, hour = 12): string => new Date(2026, month - 1, day, hour).toISOString();

/**
 * Progress data for players a and b between two times.
 * @param start Start of the chart
 * @param end End of the chart
 * @param points The points, as [user, time, count]
 * @returns The data
 */
const progressData = (start: string, end: string, points: [string, string, number][]): ProgressData => ({
  players: [{ userId: 'a', name: 'A' }, { userId: 'b', name: 'B' }],
  points: points.map(([userId, recordedAt, completedTasks]) => ({ userId, recordedAt, completedTasks })),
  start,
  end,
});

describe('progress buckets', () => {
  it('has one row per local day from the start to the end of the chart (23-progress-chart.md – Chart)', () => {
    // Arrange
    const data = progressData(local(1, 1, 9), local(1, 3, 18), []);

    // Act
    const rows = bucketProgress(data, 'day');

    // Assert
    expect(rows.map((row) => row.time)).toEqual([
      new Date(2026, 0, 1).getTime(),
      new Date(2026, 0, 2).getTime(),
      new Date(2026, 0, 3).getTime(),
    ]);
  });

  it('shows a player\'s count at the end of the day (23-progress-chart.md – Chart)', () => {
    // Arrange
    const data = progressData(local(1, 1, 8), local(1, 1, 22), [['a', local(1, 1, 9), 1], ['a', local(1, 1, 15), 2]]);

    // Act
    const rows = bucketProgress(data, 'day');

    // Assert
    expect(rows[0].values.a).toBe(2);
  });

  it('carries the value into a day without a point (23-progress-chart.md – Chart)', () => {
    // Arrange
    const data = progressData(local(1, 1, 8), local(1, 3), [['a', local(1, 1, 9), 3]]);

    // Act
    const rows = bucketProgress(data, 'day');

    // Assert
    expect(rows.map((row) => row.values.a)).toEqual([3, 3, 3]);
  });

  it('shows 0 before a player\'s first point (23-progress-chart.md – Chart)', () => {
    // Arrange
    const data = progressData(local(1, 1, 8), local(1, 2), [['b', local(1, 2, 9), 1]]);

    // Act
    const rows = bucketProgress(data, 'day');

    // Assert
    expect(rows.map((row) => row.values.b)).toEqual([0, 1]);
  });

  it('has one row per local month, with the count at the end of each month (23-progress-chart.md – Chart)', () => {
    // Arrange
    const data = progressData(local(1, 20), local(3, 5), [['a', local(1, 25), 1], ['a', local(2, 10), 4]]);

    // Act
    const rows = bucketProgress(data, 'month');

    // Assert
    expect(rows.map((row) => row.time)).toEqual([
      new Date(2026, 0, 1).getTime(),
      new Date(2026, 1, 1).getTime(),
      new Date(2026, 2, 1).getTime(),
    ]);
    expect(rows.map((row) => row.values.a)).toEqual([1, 4, 4]);
  });
});
