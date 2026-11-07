/**
 * DB tests for notifications: table structure, publishing, release, batching, cancellation, reading and settings.
 * Spec Reference: 19-notifications.md - Events, Release, Cancellation, Notification List, Links, Settings
 */

import { describe, expect, it } from 'vitest';
import { releaseDueNotifications } from '@/lib/notifications/dispatcher';
import { notifications } from '@/lib/notifications';
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  setNotificationsEnabled,
} from '@/lib/notifications/repository';
import { CellState } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
  type GameFixture,
  type UserFixture,
} from './support/fixtures';
import { countRows } from './support/rows';
import { getColumns } from './support/schema';
import { execute, query } from './support/test-connection';

/** A started game of two players, where the actor has a card of completed cells. */
interface NotificationSetup {
  actor: UserFixture;
  teammate: UserFixture;
  game: GameFixture;
  cellIds: string[];
}

/**
 * Build a started game of two players; the actor's card has the given number of completed cells.
 * @param cellCount How many cells the actor's card has (default 1)
 * @returns The players, the game and the actor's cells
 */
const createNotificationSetup = async (cellCount = 1): Promise<NotificationSetup> => {
  const actor = await createUser();
  const teammate = await createUser();
  const team = await seedTeam(actor);
  await addMember(team, teammate);
  const game = await seedGame(team, [actor, teammate]);
  const card = await createCard(game, actor, Array.from({ length: cellCount }, () => ({ state: CellState.COMPLETED })));
  return { actor, teammate, game, cellIds: card.cellIds };
};

/**
 * Make every pending event older than the 15-second release delay.
 */
const makePendingEventsDue = async (): Promise<void> => {
  await execute('UPDATE notification_events SET created_at = NOW() - INTERVAL 20 SECOND WHERE published_at IS NULL');
};

/**
 * Read a user's notifications as event id and item count.
 * @param user The recipient
 * @returns One entry per notification received
 */
const readReceived = async (user: UserFixture): Promise<{ type: string; item_count: number }[]> =>
  query<{ type: string; item_count: number }[]>(
    `SELECT e.type, e.item_count FROM notification_recipients r JOIN notification_events e ON e.id = r.event_id
      WHERE r.user_id = ?`,
    [user.id]
  );

describe('notifications', () => {
  describe('structure', () => {
    it('has the expected notification_events columns (19-notifications.md – Data Model)', async () => {
      // Act
      const columns = await getColumns('notification_events');

      // Assert
      expect(columns).toEqual([
        { name: 'id', type: 'varchar(36)', nullable: false, generated: false },
        {
          name: 'type',
          type: "enum('card_progress','member_joined','game_started','bingo_scored','game_ended','proof_requested')",
          nullable: false,
          generated: false,
        },
        { name: 'team_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'team_name', type: 'varchar(255)', nullable: false, generated: false },
        { name: 'game_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'game_name', type: 'varchar(255)', nullable: true, generated: false },
        { name: 'actor_user_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'target_user_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'cell_id', type: 'varchar(36)', nullable: true, generated: false },
        { name: 'item_count', type: 'int(11)', nullable: false, generated: false },
        { name: 'created_at', type: 'datetime', nullable: false, generated: false },
        { name: 'published_at', type: 'datetime', nullable: true, generated: false },
      ]);
    });

    it('has the expected recipient and settings columns (19-notifications.md – Data Model)', async () => {
      // Act
      const recipients = await getColumns('notification_recipients');
      const settings = await getColumns('notification_settings');

      // Assert
      expect(recipients).toEqual([
        { name: 'event_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'read_at', type: 'datetime', nullable: true, generated: false },
      ]);
      expect(settings).toEqual([
        { name: 'user_id', type: 'varchar(36)', nullable: false, generated: false },
        { name: 'enabled', type: 'tinyint(1)', nullable: false, generated: false },
      ]);
    });
  });

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

    it('drops the pending events of a cell that left completed (19-notifications.md – Cancellation)', async () => {
      // Arrange
      const { actor, cellIds } = await createNotificationSetup();
      await notifications.publish({ type: 'card_progress', actorUserId: actor.id, cellId: cellIds[0] });

      // Act
      await notifications.cancelCell(cellIds[0]);

      // Assert
      expect(await countRows('notification_events', 'cell_id = ?', [cellIds[0]])).toBe(0);
    });

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

    it('a second bingo of the same player in the same game (19-notifications.md – Events)', async () => {
      // Arrange
      const { actor, game } = await createNotificationSetup();
      await notifications.publish({ type: 'bingo_scored', gameId: game.id, actorUserId: actor.id });

      // Act
      await notifications.publish({ type: 'bingo_scored', gameId: game.id, actorUserId: actor.id });

      // Assert
      expect(await countRows('notification_events', "type = 'bingo_scored' AND game_id = ?", [game.id])).toBe(1);
    });

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
