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
- It only relays signals. It never touches the database.
- `POST /internal/notify` lets the Next.js server signal rooms. The body is a list of `{ type: 'card' | 'thread' | 'resolution', id }`, and the `x-ws-secret` header must match `WS_SHARED_SECRET`. Nginx only proxies `/ws`, so the endpoint is not public.
- It refuses to start without `WS_SHARED_SECRET`.
- It joins a socket to a room only with a valid signed token.
- It rejects browser connections from another site's page (the `Origin` hostname must match the `Host`).
- Limits per socket: 4 KB per message, 30 messages per 10 seconds (the socket is closed with code `1008` beyond that), and 256 rooms.
- Clients only join rooms and listen. A signal reaches every socket in the room, including the one that made the change. Rooms are removed when their last socket leaves.

### WebSocket URL

Clients connect to `ws(s)://<current-host>/ws`.

### Room Model

| Room | Key | Joined by |
| ---- | --- | --------- |
| Card room | `card:<teamId>` | `TeamWsProvider` on open |
| Resolution room | `resolution:<resolutionId>` | Compound checklist, iterative counter and history dialog, when opened; the socket stays in the room until it closes, but their listeners are removed with the dialog |
| Thread room (spec 07) | `thread:<threadId>` | Review thread dialog, when opened, on the same terms |

### Joining a Room

- `GET /api/ws-token?type=card|thread|resolution&id=<id>` returns a token for one room, valid for 5 minutes. It returns `403` unless the user may see the data behind the room: team membership for cards and threads, and history access for resolutions. It returns `503` without `WS_SHARED_SECRET`.
- The token is the base64url JSON `{ type, id, exp }` and its HMAC-SHA256 signature, made with `WS_SHARED_SECRET`. ws-server checks it, so it never needs the database.
- A client that gets no token simply has no live updates for that room.

### WebSocket Messages

| Message              | Direction        | Body                         | Purpose                                   |
|----------------------|------------------|------------------------------|-------------------------------------------|
| `join-room`          | client → server  | `token` (top level)          | Join the room the token grants.           |
| `refresh-card`       | server → clients | none                         | Tell card room members to refresh.        |
| `refresh-resolution` | server → clients | `resolutionId` (top level)   | Tell viewers to re-fetch the resolution.  |
| `refresh-thread`     | server → clients | `threadId` (top level)       | Tell viewers to re-fetch the thread.      |

---

## Server Signals

Every mutating API route signals the rooms it affected, through `notifyRooms` (`lib/ws-notify.ts`) after its database work. Rooms are resolved in `lib/team-signals.ts`. A failed signal is logged and never fails the mutation.

| Change | Rooms signalled |
|--------|-----------------|
| Cell state, undo, edit, proof request | The team's card room, and the cell's threads |
| Thread message, file, vote that keeps it open | The thread |
| Thread closed by vote or by the completing user | The thread and the team's card room |
| Subtask or counter change, resolution saved | The resolution, and the card room of every team showing it |
| Resolution deleted | The card room of every team that was showing it |
| Manual history note | The resolution |
| Join, game start, team deletion | The team's card room |
| Profile update | The card room of each of the user's teams |

The deadline procedure runs in the database and cannot send a signal.

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
| Undo completion              | `completed`, `pending_review`, `accomplished` | `pending`        |
| Request proof                | `completed`                                   | `pending_review` |
| Automatic completion/revert  | The state read just before                    | `completed` or `pending` |

If `affectedRows === 0`, the cell was already transitioned by another operation and the API returns `400` with a message, for example "Cell state has changed — please refresh and try again". Automatic completion does not report this; it simply leaves the cell alone.

Other mutations are not guarded on cell state:
- Thread closure (votes or the completing user) is guarded on the thread instead: `WHERE status = 'open'`. If the thread was already closed, the transaction rolls back messages and cell state; proof files removed before the transaction stay removed.
- Cell edits (spec 09) are guarded against `pending_review`. The deadline procedure (spec 07) writes the state without any guard.

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

- Wraps the team page tabs and each dashboard card, and opens **one** WebSocket per provider, so all tabs and cards on a team page share it.
- Joins `card:<teamId>` and every tracked room on open.
- Exposes `joinRoom`, `addMessageListener` and `teamName` through `useTeamWs()`. All rooms of a page share its one socket, through `useWsRoom`.
- Dispatches every incoming message to registered listeners.
- Closes the socket on unmount.

### `LeaderboardRefreshListener` (LeaderboardRefreshListener.tsx)

- Rendered above the team page tabs, so it stays mounted on every tab.
- On `refresh-card`, re-renders the page from the server so the leaderboard shows the persisted values (spec 12).

Outside a provider, `useTeamWs()` returns no-op functions. The history dialog on `/resolutions` runs this way (spec 13).

### `BingoCardContent` (BingoCardContent.tsx)

- Owns the card state and `reloadCard`. It reloads the card after the viewer's own changes.

### Child Components

`ResolutionCell` and its dialogs simply call `onUpdate` / `onRefresh`.

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

- **Cards do not update live.** The server sends `refresh-card`, but only the leaderboard acts on it. Other viewers see card changes only after reloading the page.

---

## Relation to Other Specs

- **06 — Bingo Gameplay**: defines cell state transitions.
- **07 — Proof and Approval**: defines thread-level real-time messaging (thread rooms).
- **08 — Visibility and Updates**: high-level behavior of updates.
- **09 — Bingo Card Editing**: edit operations signal the same rooms.
- **13 — Resolution History and Progress**: uses resolution rooms.
