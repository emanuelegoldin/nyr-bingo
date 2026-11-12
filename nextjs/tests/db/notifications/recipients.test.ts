/**
 * DB tests for who receives a released notification.
 * Spec Reference: 19-notifications.md - Events, Settings
 */

import { describe, expect, it } from 'vitest';
import { notifications } from '@/lib/notifications';
import { releaseDueNotifications } from '@/lib/notifications/dispatcher';
import { setNotificationsEnabled } from '@/lib/notifications/repository';
import { addMember, createUser } from '../../support/db/fixtures';
import { countRows } from '../../support/db/rows';
import { execute } from '../../support/db/test-connection';
import { createNotificationSetup, makePendingEventsDue, readReceived } from './helpers';

describe('notifications – recipients', () => {
  describe('operations', () => {
    it('releases a due event to the players except the actor (19-notifications.md – Events)', async () => {
      // Arrange
      const { actor, teammate, game } = await createNotificationSetup();
      await notifications.publish({ type: 'game_started', gameId: game.id, actorUserId: actor.id });
      await makePendingEventsDue();

      // Act
      await releaseDueNotifications();

      // Assert
      expect(await readReceived(teammate)).toEqual([{ type: 'game_started', item_count: 1 }]);
      expect(await readReceived(actor)).toEqual([]);
      expect(await countRows('notification_events', 'game_id = ? AND published_at IS NULL', [game.id])).toBe(0);
    });

    it('sends a proof request only to the card owner (19-notifications.md – Events)', async () => {
      // Arrange
      const { actor, teammate, cellIds } = await createNotificationSetup();
      await notifications.publish({ type: 'proof_requested', actorUserId: teammate.id, cellId: cellIds[0] });
      await makePendingEventsDue();

      // Act
      await releaseDueNotifications();

      // Assert
      expect(await readReceived(actor)).toEqual([{ type: 'proof_requested', item_count: 1 }]);
      expect(await readReceived(teammate)).toEqual([]);
    });

    it('sends a game invitation only to the invited player (19-notifications.md – Events)', async () => {
      // Arrange
      const { actor, teammate, game } = await createNotificationSetup();
      const invited = await createUser();
      await addMember({ id: game.teamId, leaderId: actor.id }, invited);
      await execute('INSERT INTO game_players (game_id, user_id) VALUES (?, ?)', [game.id, invited.id]);
      await notifications.publish({ type: 'game_invited', gameId: game.id, actorUserId: actor.id, targetUserId: invited.id });
      await makePendingEventsDue();

      // Act
      await releaseDueNotifications();

      // Assert
      expect(await readReceived(invited)).toEqual([{ type: 'game_invited', item_count: 1 }]);
      expect(await readReceived(teammate)).toEqual([]);
      expect(await readReceived(actor)).toEqual([]);
    });
  });

  describe('rejects', () => {
    it('notifying a user who turned notifications off (19-notifications.md – Settings)', async () => {
      // Arrange
      const { actor, teammate, game } = await createNotificationSetup();
      await setNotificationsEnabled(teammate.id, false);
      await notifications.publish({ type: 'game_started', gameId: game.id, actorUserId: actor.id });
      await makePendingEventsDue();

      // Act
      await releaseDueNotifications();

      // Assert
      expect(await readReceived(teammate)).toEqual([]);
      expect(await countRows('notification_events', 'game_id = ?', [game.id])).toBe(0);
    });
  });
});
