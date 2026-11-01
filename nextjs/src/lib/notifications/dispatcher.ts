/**
 * Releasing pending notification events to their recipients (spec 19).
 * Pending events live in the database, so a restart loses nothing. All times are database times.
 */

import type { PoolConnection } from 'mysql2/promise';
import { execute, query, withTransaction } from '../db/connection';
import { notifyRooms } from '../ws-notify';
import type { NotificationType } from './types';

/** How long an event stays pending, so it can still be cancelled or batched. */
const RELEASE_DELAY_SECONDS = 15;

interface PendingEvent {
  id: string;
  type: NotificationType;
  team_id: string;
  game_id: string | null;
  actor_user_id: string | null;
  target_user_id: string | null;
}

let isReleasing = false;

/**
 * Collapse the pending progress of the event's actor and game into the event, the oldest of them.
 *
 * @param event - The event being released.
 * @param connection - The transaction.
 * @returns How many events it now stands for.
 */
async function collapseProgressBatch(event: PendingEvent, connection: PoolConnection): Promise<number> {
  const batch = await query<Array<{ id: string }>>(
    `SELECT id FROM notification_events
     WHERE type = 'card_progress' AND game_id = ? AND actor_user_id = ? AND published_at IS NULL
     FOR UPDATE`,
    [event.game_id, event.actor_user_id],
    connection
  );

  await execute(
    `DELETE FROM notification_events
     WHERE type = 'card_progress' AND game_id = ? AND actor_user_id = ? AND published_at IS NULL
       AND id <> ?`,
    [event.game_id, event.actor_user_id, event.id],
    connection
  );
  return batch.length;
}

/**
 * Write the recipients of an event: its target or its team, without the actor and without users
 * who turned notifications off.
 *
 * @param event - The event.
 * @param connection - The transaction.
 * @returns The ids of the recipients.
 */
async function insertRecipients(event: PendingEvent, connection: PoolConnection): Promise<string[]> {
  const audience = event.target_user_id
    ? { sql: `SELECT id AS user_id FROM users WHERE id = ?`, param: event.target_user_id }
    : { sql: `SELECT user_id FROM team_memberships WHERE team_id = ?`, param: event.team_id };

  await execute(
    `INSERT INTO notification_recipients (event_id, user_id)
     SELECT ?, audience.user_id
     FROM (${audience.sql}) audience
     LEFT JOIN notification_settings s ON s.user_id = audience.user_id
     WHERE audience.user_id <> COALESCE(?, '') AND (s.enabled IS NULL OR s.enabled)`,
    [event.id, audience.param, event.actor_user_id],
    connection
  );

  const rows = await query<Array<{ user_id: string }>>(
    `SELECT user_id FROM notification_recipients WHERE event_id = ?`,
    [event.id],
    connection
  );
  return rows.map((row) => row.user_id);
}

/**
 * Release one event, with its batch. The lock and the `published_at` check make a second release
 * of the same event, or of an event already collapsed into another, do nothing.
 *
 * @param eventId - The event.
 * @returns The ids of the recipients.
 */
async function releaseEvent(eventId: string): Promise<string[]> {
  return withTransaction(async (connection) => {
    const events = await query<PendingEvent[]>(
      `SELECT id, type, team_id, game_id, actor_user_id, target_user_id
       FROM notification_events
       WHERE id = ? AND published_at IS NULL
       FOR UPDATE`,
      [eventId],
      connection
    );
    const event = events[0];
    if (!event) return [];

    const itemCount = event.type === 'card_progress' ? await collapseProgressBatch(event, connection) : 1;
    const recipients = await insertRecipients(event, connection);

    if (recipients.length === 0) {
      await execute(`DELETE FROM notification_events WHERE id = ?`, [event.id], connection);
    } else {
      await execute(
        `UPDATE notification_events SET published_at = NOW(), item_count = ? WHERE id = ?`,
        [itemCount, event.id],
        connection
      );
    }
    return recipients;
  });
}

/**
 * Release every event whose delay is over, oldest first, and signal the recipients. A failure on
 * one event does not stop the others, and that event is tried again at the next run.
 * Does nothing if the previous run is still going.
 */
export async function releaseDueNotifications(): Promise<void> {
  if (isReleasing) return;
  isReleasing = true;

  try {
    const due = await query<Array<{ id: string }>>(
      `SELECT id FROM notification_events
       WHERE published_at IS NULL AND created_at <= NOW() - INTERVAL ${RELEASE_DELAY_SECONDS} SECOND
       ORDER BY created_at, id`
    );

    const recipients = new Set<string>();
    for (const { id } of due) {
      try {
        for (const userId of await releaseEvent(id)) recipients.add(userId);
      } catch (error) {
        console.error('[notifications] failed to release event:', id, error);
      }
    }

    await notifyRooms([...recipients].map((id) => ({ type: 'user', id })));
  } finally {
    isReleasing = false;
  }
}
