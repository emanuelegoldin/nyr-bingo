/**
 * Unit tests for the deadline information of a game: the preparation countdown and how urgent each deadline looks.
 * Spec Reference: 16-games.md - Countdown, Game Page
 */

import { describe, expect, it } from 'vitest';
import { getCountdownParts, getLastDayUrgency, getPreparationUrgency } from '@/lib/shared/deadline';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('deadline', () => {
  describe('countdown', () => {
    it('splits the time left into days, hours, minutes and seconds (16-games.md – Countdown)', () => {
      // Arrange
      const now = Date.UTC(2027, 0, 1, 12, 0, 0);
      const target = now + 2 * DAY + 4 * HOUR + 12 * MINUTE + 9 * SECOND;

      // Act
      const parts = getCountdownParts(target, now);

      // Assert
      expect(parts).toEqual({ days: 2, hours: 4, minutes: 12, seconds: 9, remainingMs: target - now });
    });

    it('stops at zero once the deadline has passed (16-games.md – Countdown)', () => {
      // Arrange
      const now = Date.UTC(2027, 0, 1, 12, 0, 0);

      // Act
      const parts = getCountdownParts(now - MINUTE, now);

      // Assert
      expect(parts).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0, remainingMs: 0 });
    });
  });

  describe('urgency', () => {
    it.each([
      { left: 2 * DAY, urgency: 'normal' },
      { left: 24 * HOUR + SECOND, urgency: 'normal' },
      { left: 24 * HOUR, urgency: 'warning' },
      { left: HOUR + SECOND, urgency: 'warning' },
      { left: HOUR, urgency: 'critical' },
      { left: 0, urgency: 'critical' },
    ])('shows a countdown with $left ms left as $urgency (16-games.md – Countdown)', ({ left, urgency }) => {
      // Act
      const result = getPreparationUrgency(left);

      // Assert
      expect(result).toBe(urgency);
    });

    it.each([
      { deadline: '2027-01-10', urgency: 'normal' },
      { deadline: '2027-01-05', urgency: 'normal' },
      { deadline: '2027-01-04', urgency: 'warning' },
      { deadline: '2027-01-02', urgency: 'warning' },
      { deadline: '2027-01-01', urgency: 'critical' },
    ])('shows a last day of $deadline, seen on 2027-01-01, as $urgency (16-games.md – Game Page)', ({ deadline, urgency }) => {
      // Act
      const result = getLastDayUrgency(deadline, '2027-01-01');

      // Assert
      expect(result).toBe(urgency);
    });
  });
});
