/**
 * Deadline helpers: parsing the preparation deadline, the countdown to it, and how urgent a deadline looks.
 * Pure functions usable from server and client code.
 * Spec Reference: 16-games.md - Game Creation, Countdown, Game Page
 */

/** How a deadline is styled: normal text, warning, or critical (destructive). */
export type DeadlineUrgency = 'normal' | 'warning' | 'critical';

/** The time left until a deadline, split for display. */
export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** The time left in milliseconds, never below 0 */
  remainingMs: number;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** From this much time left, the countdown is a warning (spec 16 - Countdown). */
export const PREPARATION_WARNING_MS = 24 * HOUR_MS;
/** From this much time left, the countdown is critical. */
export const PREPARATION_CRITICAL_MS = HOUR_MS;
/** From this many days before the last day, the last day is a warning (spec 16 - Game Page). */
export const LAST_DAY_WARNING_DAYS = 3;

/** An ISO 8601 date-time with a time zone, e.g. 2027-01-05T18:00:00.000Z or 2027-01-05T19:00+01:00. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parse an ISO 8601 date-time that states its time zone, as the New Game dialog sends the preparation deadline.
 *
 * @param value - The value from a request body.
 * @returns The moment, or null for anything else (no time zone, not a real date, not a string).
 */
export const parseIsoDateTime = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !ISO_DATE_TIME.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Split the time left until a deadline into days, hours, minutes and seconds.
 *
 * @param targetMs - The deadline, in milliseconds since the epoch.
 * @param nowMs - The current time, in milliseconds since the epoch.
 * @returns The parts, all 0 once the deadline has passed.
 */
export const getCountdownParts = (targetMs: number, nowMs: number): CountdownParts => {
  const remainingMs = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(remainingMs / DAY_MS),
    hours: Math.floor((remainingMs % DAY_MS) / HOUR_MS),
    minutes: Math.floor((remainingMs % HOUR_MS) / MINUTE_MS),
    seconds: Math.floor((remainingMs % MINUTE_MS) / SECOND_MS),
    remainingMs,
  };
};

/**
 * How urgent the preparation countdown looks.
 *
 * @param remainingMs - The time left until the preparation deadline.
 * @returns Critical from 1 hour left, warning from 24 hours, normal before.
 */
export const getPreparationUrgency = (remainingMs: number): DeadlineUrgency => {
  if (remainingMs <= PREPARATION_CRITICAL_MS) return 'critical';
  if (remainingMs <= PREPARATION_WARNING_MS) return 'warning';
  return 'normal';
};

/**
 * How urgent the last day of a running game looks.
 *
 * @param deadline - The last playable day, YYYY-MM-DD.
 * @param today - Today, YYYY-MM-DD, in the viewer's time zone.
 * @returns Critical on the last day (or after it), warning up to 3 days before it, normal before.
 */
export const getLastDayUrgency = (deadline: string, today: string): DeadlineUrgency => {
  const daysLeft = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (daysLeft <= 0) return 'critical';
  if (daysLeft <= LAST_DAY_WARNING_DAYS) return 'warning';
  return 'normal';
};
