/**
 * Turning a notification into text for the user's language (spec 19). Safe to use in the browser.
 */

import type { Dictionary } from '@/i18n/dictionary';
import type { UserNotification } from './types';

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/**
 * Pick the template of a notification.
 *
 * @param notification - The notification.
 * @param strings - The `Notifications` section of the dictionary.
 * @returns The template.
 */
function pickTemplate(notification: UserNotification, strings: Dictionary['Notifications']): string {
  switch (notification.type) {
    case 'card_progress':
      return notification.itemCount > 1 ? strings.cardProgressMany : strings.cardProgressOne;
    case 'member_joined':
      return strings.memberJoined;
    case 'game_started':
      return strings.gameStarted;
    case 'game_ended':
      return notification.actorUsername ? strings.gameEnded : strings.gameEndedAtDeadline;
    case 'bingo_scored':
      return strings.bingoScored;
    case 'proof_requested':
      return strings.proofRequested;
  }
}

/**
 * Build the sentence of a notification.
 *
 * @param notification - The notification.
 * @param strings - The `Notifications` section of the dictionary.
 * @returns The sentence.
 */
export function notificationText(notification: UserNotification, strings: Dictionary['Notifications']): string {
  return pickTemplate(notification, strings)
    .replace('{actor}', notification.actorUsername ?? strings.someone)
    .replace('{count}', String(notification.itemCount));
}

/**
 * Format how long ago something happened, e.g. "2 minutes ago".
 *
 * @param isoDate - When it happened.
 * @param locale - The language.
 * @param now - The current time, in milliseconds.
 * @returns The formatted time.
 */
export function formatRelativeTime(isoDate: string, locale: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(isoDate).getTime() - now) / 1000);
  const elapsed = Math.abs(seconds);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (elapsed < MINUTE_SECONDS) return formatter.format(0, 'second');
  if (elapsed < HOUR_SECONDS) return formatter.format(Math.round(seconds / MINUTE_SECONDS), 'minute');
  if (elapsed < DAY_SECONDS) return formatter.format(Math.round(seconds / HOUR_SECONDS), 'hour');
  return formatter.format(Math.round(seconds / DAY_SECONDS), 'day');
}
