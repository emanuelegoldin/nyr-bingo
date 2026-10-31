import { WSMessage } from "./ws-message";

/**
 * Sent by a client to join a resolution-level room so it can
 * receive real-time updates when the resolution's progress changes
 * (e.g. subtask toggled, iteration incremented/decremented).
 *
 * Room key: `resolution:<resolutionId>`
 */
export interface JoinResolutionRoomMessage extends WSMessage {
  type: "join-resolution-room";
  body: {
    resolutionId: string;
  };
}
