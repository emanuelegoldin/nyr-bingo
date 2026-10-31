/** A change the Next.js server announces, and the room whose viewers must refetch. */
export interface RoomNotification {
  type: 'card' | 'thread' | 'resolution';
  /** The team, thread or resolution id. */
  id: string;
}
