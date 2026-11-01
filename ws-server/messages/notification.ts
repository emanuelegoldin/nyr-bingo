/** A change the Next.js server announces, and the room whose viewers must refetch. */
export interface RoomNotification {
  type: 'card' | 'thread' | 'resolution' | 'user';
  /** The team, thread, resolution or user id. */
  id: string;
}
