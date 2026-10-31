# 11 — Real-Time Updates and Conflict Resolution

## Purpose

Define the WebSocket signaling used around bingo cards and resolutions, and the rules that keep concurrent cell mutations consistent.

This specification covers:
- **WebSocket rooms and messages** for cards and resolutions.
- **Conflict resolution** when concurrent operations target the same cell.

It details the mechanism behind **08 — Visibility and Updates**.

---

## User Stories Covered

- When a resolution's progress changes, users viewing it in an open dialog see the change in real time.
- When two users perform conflicting actions on the same cell concurrently, a deterministic winner is chosen to prevent inconsistent state.

---

## In Scope

- Team-level card rooms
- Resolution-level rooms
- Optimistic locking (state precondition guards) on cell mutations
- Conflict resolution rules

---

## Architecture Overview

### WebSocket Server

- `ws-server/server.ts` is a standalone Node service listening on `WS_PORT` (default `8888`). Nginx proxies `/ws` to it.
- It only relays signals between sockets. It never touches the database.
- It performs no authentication and no membership check; any connected socket can join any room.
- Broadcasts exclude the sending socket. Rooms are removed when their last socket leaves.

### WebSocket URL

Clients connect to `ws(s)://<current-host>/ws`.

### Room Model

| Room | Key | Joined by |
| ---- | --- | --------- |
| Card room | `card:<teamId>` | `TeamWsProvider` on open |
| Resolution room | `resolution:<resolutionId>` | Compound checklist, iterative counter and history dialog, when opened; the socket stays in the room until it closes, but their listeners are removed with the dialog |
| Thread room (spec 07) | `<threadId>` | Review thread dialog, while open |

### WebSocket Messages

| Message                | Direction        | Body                       | Purpose                                         |
|------------------------|------------------|----------------------------|-------------------------------------------------|
| `join-card-room`       | client → server  | `{ teamId: string }`       | Join the team-level card room.                  |
| `card-refresh`         | client → server  | `{ teamId: string }`       | Signal that the sender reloaded a card.         |
| `refresh-card`         | server → clients | none                       | Tell card room members about the change.        |
| `join-resolution-room` | client → server  | `{ resolutionId: string }` | Join a resolution room.                         |
| `resolution-refresh`   | client → server  | `{ resolutionId: string }` | Signal that a resolution changed.               |
| `refresh-resolution`   | server → clients | `resolutionId` (top level) | Tell viewers to re-fetch the resolution.        |

---

## When Card-Refresh Is Sent

`card-refresh` is sent by `reloadCard` in `BingoCardContent`, after it has fetched the card, unless the API returned an error. So it follows any operation that reloads the card through the `onRefresh` or `onUpdate` callbacks:

| Operation                 | Component / Dialog                                     |
|---------------------------|--------------------------------------------------------|
| Mark resolution completed | `MarkCellCompleteDialog` → `onUpdate`                  |
| Undo completion           | `ResolutionDetailDialog` → `onUpdate`                  |
| Request proof             | `RequestProofDialog` → `onRefresh`                     |
| Vote on review thread     | `CellThreadDialog` → `onRefresh`                       |
| Thread message or file    | `CellThreadDialog` → `onRefresh`                       |
| Close review thread       | `CellThreadDialog` → `onRefresh`                       |
| Subtask or counter change | `ResolutionDetailDialog` → `onRefresh`                 |
| Edit cell content         | `EditCellDialog` → `onRefresh`                         |

`handleCellUpdate` also sends it after a failed mark or undo.

---

## When Resolution-Refresh Is Sent

| Operation            | Component                |
|----------------------|--------------------------|
| Subtask toggled      | `CompoundChecklist`      |
| Counter changed      | `IterativeCounter`       |
| Manual history note  | `ResolutionHistoryDialog` |

On `refresh-resolution` for the resolution they display, the checklist and counter re-fetch it from `GET /api/resolutions/compound?id=` or `GET /api/resolutions/iterative?id=`, and the history dialog reloads its timeline.

---

## Conflict Resolution

### Problem

Two concurrent operations may target the same cell:

1. **Owner undoes completion** (`POST /api/cells/:id/undo-complete`)
   while simultaneously
2. **Team member requests proof** (`POST /api/cells/:id/request-proof`)

Without protection, both operations could succeed based on stale reads, leaving the cell in an inconsistent state.

### Solution — Optimistic Locking via State Precondition Guards

The mutations of `bingo_cells.state` in this table include a `WHERE state ...` guard:

| Operation                    | Expected state(s)                             | Target state     |
|------------------------------|-----------------------------------------------|------------------|
| Mark completed               | `pending`                                     | `completed`      |
| `PUT` to `pending`           | `completed`                                   | `pending`        |
| `PUT` to `accomplished`      | `pending_review`                              | `accomplished`   |
| Undo completion              | `completed`, `pending_review`, `accomplished` | `pending`        |
| Request proof                | `completed`                                   | `pending_review` |
| Automatic completion/revert  | The state read just before                    | `completed` or `pending` |

If `affectedRows === 0`, the cell was already transitioned by another operation and the API returns `400` with a message, for example "Cell state has changed — please refresh and try again". Automatic completion does not report this; it simply leaves the cell alone.

Other mutations are not guarded on cell state:
- Thread closure (votes or the completing user) is guarded on the thread instead: `WHERE status = 'open'`. If the thread was already closed, the transaction rolls back messages and cell state; proof files removed before the transaction stay removed.
- Cell edits (spec 09) and the deadline procedure (spec 07) write the state without any guard.

### Owner-Prevails Rule

When the owner undoes completion and a team member requests proof concurrently:

- **Owner's undo** runs inside a transaction that first closes any open review thread, then sets state to `pending` with `WHERE state IN ('completed', 'pending_review', 'accomplished')`.
- **Team member's proof request** guards the state transition with `WHERE state = 'completed'` and rolls back when no row matched.

Because the undo accepts a wider set of source states and closes the thread in the same transaction, the owner's action succeeds regardless of ordering. The proof request either:
- Succeeds first (cell moves to `pending_review`), then the undo succeeds and reverts it.
- Fails because the cell is already `pending` (the undo completed first).

In both cases the final state is `pending`, honouring the owner's intent.

---

## Component Responsibilities

### `TeamWsProvider` (team-ws-provider.tsx)

- Wraps the Cards tab (once cards exist) and each dashboard card, and opens **one** WebSocket per provider, so all cards on a team page share it.
- Joins `card:<teamId>` on open and queues messages sent while connecting.
- Exposes `broadcastCardRefresh`, `sendWsMessage`, `addMessageListener` and `teamName` through `useTeamWs()`.
- Dispatches every incoming message to registered listeners, and calls its optional `onRefresh` prop on `refresh-card` and `refresh-thread`.
- Closes the socket on unmount.

Outside a provider, `useTeamWs()` returns no-op functions. The history dialog on `/resolutions` runs this way (spec 13).

### `BingoCardContent` (BingoCardContent.tsx)

- Owns the card state and `reloadCard`, and broadcasts `card-refresh` after each reload.

### Child Components

`ResolutionCell` and its dialogs simply call `onUpdate` / `onRefresh`. They do **not** broadcast `card-refresh` themselves.

---

## Acceptance Criteria

- Users viewing a resolution in an open dialog see subtask and counter changes without reloading.
- If two users perform conflicting operations, the system resolves the conflict deterministically (owner's action prevails).
- Failed operations due to state conflicts return a descriptive error to the acting user.
- No WebSocket connection is leaked on component unmount.
- The WebSocket server isolates card, resolution and thread rooms through different key prefixes.

---

## Out of Scope

- Offline support / retry queues.
- Granular cell-level diffing (clients re-fetch the full card).
- Push notifications for card changes.

---

## Known Gaps

- **Cards do not update live.** Clients send `card-refresh` and the server relays `refresh-card`, but nothing acts on it: neither use of `TeamWsProvider` passes `onRefresh`, and no listener handles `refresh-card`. The `onRefresh` prop was dropped from the Cards tab in commit `b97ee3b`. Other viewers see card changes only after reloading the page.
- The WebSocket server has no authentication, so anyone able to reach it can join rooms and trigger refresh signals. Messages carry no resolution or card content.

---

## Relation to Other Specs

- **06 — Bingo Gameplay**: defines cell state transitions.
- **07 — Proof and Approval**: defines thread-level real-time messaging (thread rooms).
- **08 — Visibility and Updates**: high-level behavior of updates.
- **09 — Bingo Card Editing**: edit operations broadcast via the same mechanism.
- **13 — Resolution History and Progress**: uses resolution rooms.
