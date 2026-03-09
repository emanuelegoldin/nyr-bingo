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

/**
 * Sent by the owner's client after persisting a resolution-level
 * mutation (subtask toggle, iteration increment/decrement).
 *
 * The server broadcasts a `refresh-resolution` event to every
 * *other* socket in the resolution room so viewers can re-fetch.
 */
export interface ResolutionRefreshMessage extends WSMessage {
  type: "resolution-refresh";
  body: {
    resolutionId: string;
  };
}
