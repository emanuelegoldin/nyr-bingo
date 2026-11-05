/** A change the Next.js server announces, and the room whose viewers must refetch. */
export interface RoomNotification {
  type: 'card' | 'thread' | 'user';
  /** The team, thread or user id. */
  id: string;
}
