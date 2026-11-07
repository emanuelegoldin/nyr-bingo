/**
 * DB tests for listing notifications and marking them read.
 * Spec Reference: 19-notifications.md - Notification List, API
 */

import { describe, expect, it } from 'vitest';
import { notifications } from '@/lib/notifications';
import { releaseDueNotifications } from '@/lib/notifications/dispatcher';
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications/repository';
import { createTeam, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute } from '../../support/db/test-connection';
import { createNotificationSetup, makePendingEventsDue } from './helpers';

describe('notifications – inbox', () => {
  describe('operations', () => {
    it('lists a notification with a link to the game, then marks it read (19-notifications.md – Notification List)', async () => {
      // Arrange
      const { actor, teammate, game } = await createNotificationSetup();
      await notifications.publish({ type: 'game_started', gameId: game.id, actorUserId: actor.id });
      await makePendingEventsDue();
      await releaseDueNotifications();
      const before = await getUserNotifications(teammate.id);

      // Act
      const marked = await markNotificationRead(before.notifications[0].id, teammate.id);

      // Assert
      expect(before.unreadCount).toBe(1);
      expect(before.notifications[0]).toMatchObject({ type: 'game_started', read: false, link: `/games/${game.id}` });
      expect(marked).toBe(true);
      expect((await getUserNotifications(teammate.id)).unreadCount).toBe(0);
    });

    it('marks every notification of the user as read (19-notifications.md – Notification List)', async () => {
      // Arrange
      const { actor, teammate, game, cellIds } = await createNotificationSetup();
      await notifications.publish({ type: 'game_started', gameId: game.id, actorUserId: actor.id });
      await notifications.publish({ type: 'card_progress', actorUserId: actor.id, cellId: cellIds[0] });
      await makePendingEventsDue();
      await releaseDueNotifications();

      // Act
      await markAllNotificationsRead(teammate.id);

      // Assert
      expect(await countRows('notification_recipients', 'user_id = ? AND read_at IS NULL', [teammate.id])).toBe(0);
      expect(await countRows('notification_recipients', 'user_id = ?', [teammate.id])).toBe(2);
    });

    it('lists only the latest 50 notifications, newest first (19-notifications.md – Notification List)', async () => {
      // Arrange: 51 released notifications, one minute apart
      const user = await createUser();
      const team = await createTeam(user);
      for (let minutesAgo = 0; minutesAgo <= 50; minutesAgo += 1) {
        const eventId = `00000000-0000-4000-8000-${String(minutesAgo).padStart(12, '0')}`;
        await execute(
          `INSERT INTO notification_events (id, type, team_id, team_name, item_count, created_at, published_at)
           VALUES (?, 'member_joined', ?, 'Team', 1, NOW() - INTERVAL ? MINUTE, NOW())`,
          [eventId, team.id, minutesAgo]
        );
        await execute('INSERT INTO notification_recipients (event_id, user_id) VALUES (?, ?)', [eventId, user.id]);
      }

      // Act
      const { notifications: listed, unreadCount } = await getUserNotifications(user.id);

      // Assert
      expect(listed).toHaveLength(50);
      expect(listed[0].id).toBe('00000000-0000-4000-8000-000000000000');
      expect(listed[49].id).toBe('00000000-0000-4000-8000-000000000049');
      expect(unreadCount).toBe(51);
    });
  });

  describe('rejects', () => {
    it('marking read a notification the user did not receive (19-notifications.md – API)', async () => {
      // Arrange
      const { actor, teammate, game } = await createNotificationSetup();
      await notifications.publish({ type: 'game_started', gameId: game.id, actorUserId: actor.id });
      await makePendingEventsDue();
      await releaseDueNotifications();
      const { notifications: received } = await getUserNotifications(teammate.id);

      // Act
      const marked = await markNotificationRead(received[0].id, actor.id);

      // Assert
      expect(marked).toBe(false);
      expect((await getUserNotifications(teammate.id)).unreadCount).toBe(1);
    });
  });
});
