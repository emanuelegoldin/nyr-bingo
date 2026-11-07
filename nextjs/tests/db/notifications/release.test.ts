/**
 * DB tests for holding and releasing notification events.
 * Spec Reference: 19-notifications.md - Release
 */

import { describe, expect, it } from 'vitest';
import { notifications } from '@/lib/notifications';
import { releaseDueNotifications } from '@/lib/notifications/dispatcher';
import { countRows } from '../../support/db/rows';
import { query } from '../../support/db/test-connection';
import { createNotificationSetup, makePendingEventsDue, readReceived } from './helpers';

describe('notifications – release', () => {
  describe('operations', () => {
    it('holds a published event as pending with the team and game names (19-notifications.md – Release)', async () => {
      // Arrange
      const { actor, game, cellIds } = await createNotificationSetup();

      // Act
      await notifications.publish({ type: 'card_progress', actorUserId: actor.id, cellId: cellIds[0] });

      // Assert
      const events = await query<{ game_id: string; game_name: string; published_at: Date | null }[]>(
        'SELECT game_id, game_name, published_at FROM notification_events WHERE cell_id = ?',
        [cellIds[0]]
      );
      expect(events).toEqual([{ game_id: game.id, game_name: expect.any(String), published_at: null }]);
    });

    it('releases pending progress of one actor as one notification with a count (19-notifications.md – Release)', async () => {
      // Arrange
      const { actor, teammate, cellIds } = await createNotificationSetup(3);
      for (const cellId of cellIds) {
        await notifications.publish({ type: 'card_progress', actorUserId: actor.id, cellId });
      }
      await makePendingEventsDue();

      // Act
      await releaseDueNotifications();

      // Assert
      expect(await readReceived(teammate)).toEqual([{ type: 'card_progress', item_count: 3 }]);
    });
  });

  describe('rejects', () => {
    it('releasing an event before its 15 seconds are over (19-notifications.md – Release)', async () => {
      // Arrange
      const { actor, teammate, game } = await createNotificationSetup();
      await notifications.publish({ type: 'game_started', gameId: game.id, actorUserId: actor.id });

      // Act
      await releaseDueNotifications();

      // Assert
      expect(await readReceived(teammate)).toEqual([]);
      expect(await countRows('notification_events', 'game_id = ? AND published_at IS NULL', [game.id])).toBe(1);
    });
  });
});
