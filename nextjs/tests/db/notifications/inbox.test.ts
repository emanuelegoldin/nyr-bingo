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
import { countRows } from '../../support/db/rows';
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
