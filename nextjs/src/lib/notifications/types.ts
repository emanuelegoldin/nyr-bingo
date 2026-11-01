/**
 * The contract of the notification module (spec 19). Application code depends on these types and
 * on the `notifications` instance of ./index, never on how events are stored or released.
 */

/** Something that happened in a team and is worth telling its members. */
export type NotificationEvent =
  | { type: 'member_joined'; teamId: string; actorUserId: string }
  | { type: 'game_started'; gameId: string; actorUserId: string }
  /** The actor is null when the game ended at its deadline. */
  | { type: 'game_ended'; gameId: string; actorUserId: string | null }
  | { type: 'bingo_scored'; gameId: string; actorUserId: string }
  | { type: 'card_progress'; actorUserId: string; cellId: string }
  /** The target is the owner of the cell's card. */
  | { type: 'proof_requested'; actorUserId: string; cellId: string };

export type NotificationType = NotificationEvent['type'];

/**
 * Receives events from the application. Implementations never throw: a notification must not turn
 * a committed mutation into an error response.
 */
export interface NotificationPublisher {
  /**
   * Hold an event for release.
   *
   * @param event - What happened. `game_ended` must be published before the game is archived.
   */
  publish(event: NotificationEvent): Promise<void>;

  /**
   * Drop the pending events of a cell that left `completed`.
   *
   * @param cellId - The cell.
   */
  cancelCell(cellId: string): Promise<void>;

  /**
   * Drop the pending bingo of a player who lost it.
   *
   * @param gameId - The game.
   * @param userId - The player.
   */
  cancelBingo(gameId: string, userId: string): Promise<void>;
}

/** A notification as one user sees it. */
export interface UserNotification {
  id: string;
  type: NotificationType;
  actorUsername: string | null;
  teamName: string;
  gameName: string | null;
  /** How many events the notification stands for. */
  itemCount: number;
  createdAt: string;
  read: boolean;
  /** Where the notification leads, or null if nothing is left to open. */
  link: string | null;
}
