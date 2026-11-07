/**
 * DB tests for the notification tables: their columns.
 * Spec Reference: 19-notifications.md - Data Model
 */

import { describe, expect, it } from 'vitest';
import { notifications } from '@/lib/notifications';
import { getColumns } from '../../support/db/schema';

describe('notifications – structure', () => {
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
});
