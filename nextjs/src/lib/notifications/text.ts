/**
 * Turning a notification into text for the user's language (spec 19). Safe to use in the browser.
 */

import type { useTranslations } from 'next-intl';
import type { UserNotification } from './types';

const MINUTE_SECONDS = 60;
const HOUR_SECONDS = 60 * MINUTE_SECONDS;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/** Translation function of the `Notifications` namespace. */
export type NotificationsTranslator = ReturnType<typeof useTranslations<'Notifications'>>;

/**
 * Build the sentence of a notification.
 *
 * @param notification - The notification.
 * @param t - Translation function of the `Notifications` namespace.
 * @returns The sentence.
 */
export function notificationText(notification: UserNotification, t: NotificationsTranslator): string {
  const actor = notification.actorUsername ?? t('someone');

  switch (notification.type) {
    case 'card_progress':
      return t('cardProgress', { actor, count: notification.itemCount });
    case 'member_joined':
      return t('memberJoined', { actor });
    case 'game_started':
      return t('gameStarted');
    case 'game_ended':
      return notification.actorUsername ? t('gameEnded', { actor }) : t('gameEndedAtDeadline');
    case 'bingo_scored':
      return t('bingoScored', { actor });
    case 'proof_requested':
      return t('proofRequested', { actor });
  }
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
