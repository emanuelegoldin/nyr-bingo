/**
 * Helpers shared by the notifications DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { notifications } from '@/lib/notifications';
import { CellState } from '@/lib/shared/types';
import {
  addMember,
  createCard,
  createGame as seedGame,
  createTeam as seedTeam,
  createUser,
  type GameFixture,
  type UserFixture,
} from '../../support/db/fixtures';
import { execute, query } from '../../support/db/test-connection';

/** A started game of two players, where the actor has a card of completed cells. */
export interface NotificationSetup {
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
export const createNotificationSetup = async (cellCount = 1): Promise<NotificationSetup> => {
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
export const makePendingEventsDue = async (): Promise<void> => {
  await execute('UPDATE notification_events SET created_at = NOW() - INTERVAL 20 SECOND WHERE published_at IS NULL');
};

/**
 * Read a user's notifications as event id and item count.
 * @param user The recipient
 * @returns One entry per notification received
 */
export const readReceived = async (user: UserFixture): Promise<{ type: string; item_count: number }[]> =>
  query<{ type: string; item_count: number }[]>(
    `SELECT e.type, e.item_count FROM notification_recipients r JOIN notification_events e ON e.id = r.event_id
      WHERE r.user_id = ?`,
    [user.id]
  );
