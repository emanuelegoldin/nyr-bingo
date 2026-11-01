/**
 * Reading notifications and changing their state, for the signed-in user (spec 19).
 */

import { execute, query } from '../db/connection';
import type { NotificationType, UserNotification } from './types';

/** How many notifications a user can see. */
const LIST_LIMIT = 50;

interface NotificationRow {
  id: string;
  type: NotificationType;
  actor_username: string | null;
  team_name: string;
  game_name: string | null;
  item_count: number;
  created_at: Date;
  read_at: Date | null;
  live_game_id: string | null;
  archived_game_id: string | null;
  member_team_id: string | null;
}

/**
 * Pick what a notification opens: its game, its archived game, or its team.
 *
 * @param row - The notification.
 * @returns The link, or null if none of them is left.
 */
function resolveLink(row: NotificationRow): string | null {
  if (row.live_game_id) return `/games/${row.live_game_id}`;
  if (row.archived_game_id) return `/archive/${row.archived_game_id}`;
  if (row.member_team_id) return `/teams/${row.member_team_id}`;
  return null;
}

/**
 * List a user's latest notifications, newest first, and count the unread ones.
 *
 * @param userId - The user.
 * @returns The notifications and the number of all unread ones.
 */
export async function getUserNotifications(
  userId: string
): Promise<{ notifications: UserNotification[]; unreadCount: number }> {
  const rows = await query<NotificationRow[]>(
    `SELECT e.id, e.type, u.username AS actor_username, e.team_name, e.game_name, e.item_count,
            e.created_at, r.read_at, g.id AS live_game_id,
            agp.archived_game_id, tm.team_id AS member_team_id
     FROM notification_recipients r
     JOIN notification_events e ON r.event_id = e.id
     LEFT JOIN users u ON e.actor_user_id = u.id
     LEFT JOIN games g ON e.game_id = g.id
     LEFT JOIN archived_game_players agp ON agp.archived_game_id = e.game_id AND agp.user_id = r.user_id
     LEFT JOIN team_memberships tm ON tm.team_id = e.team_id AND tm.user_id = r.user_id
     WHERE r.user_id = ?
     ORDER BY e.created_at DESC, e.id
     LIMIT ${LIST_LIMIT}`,
    [userId]
  );
  const counts = await query<Array<{ unread: number }>>(
    `SELECT COUNT(*) AS unread FROM notification_recipients WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );

  return {
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      actorUsername: row.actor_username,
      teamName: row.team_name,
      gameName: row.game_name,
      itemCount: row.item_count,
      createdAt: row.created_at.toISOString(),
      read: row.read_at !== null,
      link: resolveLink(row),
    })),
    unreadCount: Number(counts[0].unread),
  };
}

/**
 * Mark one notification as read. Reading it twice is not an error.
 *
 * @param eventId - The notification.
 * @param userId - The user.
 * @returns False if the user did not receive it.
 */
export async function markNotificationRead(eventId: string, userId: string): Promise<boolean> {
  const rows = await query<unknown[]>(
    `SELECT 1 FROM notification_recipients WHERE event_id = ? AND user_id = ?`,
    [eventId, userId]
  );
  if (rows.length === 0) return false;

  await execute(
    `UPDATE notification_recipients SET read_at = NOW()
     WHERE event_id = ? AND user_id = ? AND read_at IS NULL`,
    [eventId, userId]
  );
  return true;
}

/**
 * Mark all of a user's notifications as read.
 *
 * @param userId - The user.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  await execute(
    `UPDATE notification_recipients SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL`,
    [userId]
  );
}

/**
 * Tell whether a user has notifications on. No row means on.
 *
 * @param userId - The user.
 * @returns True if they are on.
 */
export async function getNotificationsEnabled(userId: string): Promise<boolean> {
  const rows = await query<Array<{ enabled: number }>>(
    `SELECT enabled FROM notification_settings WHERE user_id = ?`,
    [userId]
  );
  return rows.length === 0 || Boolean(rows[0].enabled);
}

/**
 * Turn a user's notifications on or off.
 *
 * @param userId - The user.
 * @param enabled - The new setting.
 */
export async function setNotificationsEnabled(userId: string, enabled: boolean): Promise<void> {
  await execute(
    `INSERT INTO notification_settings (user_id, enabled) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled)`,
    [userId, enabled]
  );
}
