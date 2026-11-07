/**
 * Unit tests for the start, end and players of the progress chart.
 * Spec Reference: 23-progress-chart.md - Definitions, Progress Tab, Chart
 */

import { describe, expect, it } from 'vitest';
import { buildProgressData, type ProgressSource } from '@/components/progress/build-progress-data';

const NOW = new Date('2026-03-01T12:00:00.000Z');

/**
 * A source with players a and b, one point each, started and running unless overridden.
 * @param overrides Fields to change
 * @returns The source
 */
const source = (overrides: Partial<ProgressSource> = {}): ProgressSource => ({
  leaderboard: [
    { userId: 'a', username: 'alice', displayName: 'Alice', firstBingoAt: null, completedTasks: 1 },
    { userId: 'b', username: 'bob', displayName: null, firstBingoAt: null, completedTasks: 0 },
  ],
  points: [
    { userId: 'a', recordedAt: '2026-02-01T10:00:00.000Z', completedTasks: 0 },
    { userId: 'b', recordedAt: '2026-02-01T10:00:00.000Z', completedTasks: 0 },
  ],
  startedAt: '2026-02-01T10:00:00.000Z',
  endedAt: null,
  ...overrides,
});

describe('progress data', () => {
  it('ends a running game\'s chart now (23-progress-chart.md – Definitions)', () => {
    // Act
    const data = buildProgressData(source(), NOW);

    // Assert
    expect(data?.end).toBe(NOW.toISOString());
  });

  it('ends an archived game\'s chart at its end date (23-progress-chart.md – Definitions)', () => {
    // Act
    const data = buildProgressData(source({ endedAt: '2026-02-20T00:00:00.000Z' }), NOW);

    // Assert
    expect(data?.end).toBe('2026-02-20T00:00:00.000Z');
  });

  it('starts the chart at the earliest point when the start time is unknown (23-progress-chart.md – Definitions)', () => {
    // Arrange
    const points = [
      { userId: 'a', recordedAt: '2026-01-15T08:00:00.000Z', completedTasks: 0 },
      { userId: 'a', recordedAt: '2026-01-20T08:00:00.000Z', completedTasks: 1 },
    ];

    // Act
    const data = buildProgressData(source({ startedAt: null, points }), NOW);

    // Assert
    expect(data?.start).toBe('2026-01-15T08:00:00.000Z');
  });

  it('names each player by display name, or username without one, in leaderboard order (23-progress-chart.md – Colours and Legend)', () => {
    // Act
    const data = buildProgressData(source(), NOW);

    // Assert
    expect(data?.players).toEqual([{ userId: 'a', name: 'Alice' }, { userId: 'b', name: 'bob' }]);
  });

  it('has nothing to show for a game without a progress point (23-progress-chart.md – Progress Tab)', () => {
    // Act
    const data = buildProgressData(source({ points: [] }), NOW);

    // Assert
    expect(data).toBeNull();
  });
});
