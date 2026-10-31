import { WSMessage } from "./ws-message";

/**
 * Sent by a client to join a card-level room so it can receive
 * real-time updates when any bingo cell on that team changes.
 *
 * The room id is the **teamId** — every viewer of any card within
 * the team shares the same room.
 */
export interface JoinCardRoomMessage extends WSMessage {
  type: "join-card-room";
  body: {
    teamId: string;
  };
}
