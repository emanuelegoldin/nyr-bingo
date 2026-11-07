/**
 * DB tests for announcing a bingo once and dropping it when the bingo is lost.
 * Spec Reference: 19-notifications.md - Events, Cancellation
 */

import { describe, expect, it } from 'vitest';
import { refreshLeaderboardEntry } from '@/lib/db/leaderboard-repository';
import { notifications } from '@/lib/notifications';
import { countRows } from '../../support/db/rows';
import { execute } from '../../support/db/test-connection';
import { createBingoCard, cellsAt } from '../leaderboard/helpers';
import { createNotificationSetup } from './helpers';

describe('notifications – bingo events', () => {
  describe('operations', () => {
    it('publishes one bingo event and drops it while still pending when the bingo is lost (19-notifications.md – Cancellation)', async () => {
      // Arrange
      const setup = await createBingoCard(3, cellsAt([2, 6]));
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);
      const eventsAfterBingo = await countRows('notification_events', "type = 'bingo_scored' AND game_id = ?", [setup.game.id]);
      await execute("UPDATE bingo_cells SET state = 'pending' WHERE id = ?", [setup.cellIds[0]]);

      // Act
      await refreshLeaderboardEntry(setup.game.id, setup.player.id);

      // Assert
      expect(eventsAfterBingo).toBe(1);
      expect(await countRows('notification_events', "type = 'bingo_scored' AND game_id = ?", [setup.game.id])).toBe(0);
    });
  });

  describe('rejects', () => {
    it('a second bingo of the same player in the same game (19-notifications.md – Events)', async () => {
      // Arrange
      const { actor, game } = await createNotificationSetup();
      await notifications.publish({ type: 'bingo_scored', gameId: game.id, actorUserId: actor.id });

      // Act
      await notifications.publish({ type: 'bingo_scored', gameId: game.id, actorUserId: actor.id });

      // Assert
      expect(await countRows('notification_events', "type = 'bingo_scored' AND game_id = ?", [game.id])).toBe(1);
    });
  });
});
