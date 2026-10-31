/** Sent by a client to join the room named by a token the Next.js server signed. */

export interface JoinRoomMessage {
  type: 'join-room';
  token: string;
}
