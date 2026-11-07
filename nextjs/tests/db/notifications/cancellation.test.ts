/**
 * DB tests for cancelling pending notification events.
 * Spec Reference: 19-notifications.md - Cancellation
 */

import { describe, expect, it } from 'vitest';
import { notifications } from '@/lib/notifications';
import { releaseDueNotifications } from '@/lib/notifications/dispatcher';
import { countRows } from '../../support/db/rows';
import { createNotificationSetup, makePendingEventsDue, readReceived } from './helpers';

describe('notifications – cancellation', () => {
  describe('operations', () => {
    it('drops the pending events of a cell that left completed (19-notifications.md – Cancellation)', async () => {
      // Arrange
      const { actor, cellIds } = await createNotificationSetup();
      await notifications.publish({ type: 'card_progress', actorUserId: actor.id, cellId: cellIds[0] });

      // Act
      await notifications.cancelCell(cellIds[0]);

      // Assert
      expect(await countRows('notification_events', 'cell_id = ?', [cellIds[0]])).toBe(0);
    });
  });

  describe('rejects', () => {
    it('cancelling a cell\'s event after it was released (19-notifications.md – Cancellation)', async () => {
      // Arrange
      const { actor, teammate, cellIds } = await createNotificationSetup();
      await notifications.publish({ type: 'card_progress', actorUserId: actor.id, cellId: cellIds[0] });
      await makePendingEventsDue();
      await releaseDueNotifications();

      // Act
      await notifications.cancelCell(cellIds[0]);

      // Assert
      expect(await readReceived(teammate)).toEqual([{ type: 'card_progress', item_count: 1 }]);
    });
  });
});
