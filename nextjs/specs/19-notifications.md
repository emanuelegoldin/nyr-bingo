# 19 — Notifications

## Purpose

Let users see what happened in their teams since they last looked: after logging in, and within 30 seconds while they are online.

---

## User Stories Covered

- See relevant events that happened while I was away, as soon as I log in
- Be told about an event in under 30 seconds while I am online
- Open the event in one click
- Not be told about an action that was taken back right away
- Turn notifications off, and on again

---

## In Scope

- In-app notifications: a bell in the application header, with an unread count and a list
- A short delay before release, batching and cancellation
- A setting to turn notifications off

---

## Out of Scope

- Email and browser push
- Toasts and other popups
- Notifying changes made after a notification was released, such as an undo or a card edit
- Leaderboard changes
- Settings per team or per event type
- Removing old notifications

---

## Functional Requirements

### Events

| Type | Happens when | Actor | Recipients |
| ---- | ------------ | ----- | ---------- |
| `card_progress` | A cell reaches `completed`, manually or by automatic completion (spec 06) | The card owner | The team |
| `member_joined` | A user joins the team (spec 04) | The new member | The team |
| `game_started` | The leader starts a game (spec 16) | The leader | The team |
| `bingo_scored` | A player's `first_bingo_at` (spec 12) goes from empty to set | The player | The team |
| `game_ended` | A game ends (spec 16) | The leader, or nobody at the deadline | The team |
| `proof_requested` | A member requests proof on a cell (spec 07) | The requester | The card owner |

- The team means its members when the notification is released.
- An actor never receives their own event.
- `failed` and `accomplished` cells are not progress. An `accomplished` cell was already announced when it was completed.
- A `team` cell of a `compound` or `iterative` goal is not progress, because one change moves that cell on every card. A bingo it causes is still announced.
- A bingo is announced at most once per player per game. A proof request clears `first_bingo_at` and accepting the proof sets it again, which is the same bingo.

### Release

- Events are held as pending for 15 seconds and released by a server loop that runs every 5 seconds, so a notification appears about 20 seconds after the event at worst. Every event type follows this path.
- The delay is measured from the first event of a batch, so more events cannot postpone it.
- `card_progress` events of the same actor and game that are pending together are released as one notification with a count. No other type is batched.
- Pending events are stored in the database, so a server restart does not lose them.
- Publishing and releasing never fail the action that caused them. Failures are logged.

### Cancellation

- A cell that leaves `completed` while its event is pending (undo, card edit or automatic revert) cancels every pending event of that cell, and nothing is released.
- A player who loses their bingo while its event is pending cancels that event.
- After release, a notification is never changed or withdrawn.

### Notification List

- A bell in the application header (spec 14) shows the number of unread notifications, on every page of the shell.
- Clicking the bell opens a list of the latest 50 notifications, newest first, showing the text, the game or team name and the relative time. Unread items are marked.
- An empty list shows a message saying there is nothing new.
- Opening the list does not mark anything as read.
- Clicking an item marks it as read and opens its link.
- **Mark all as read** marks every notification of the user as read.
- The text is built in the browser from the type, so it follows the user's language (spec 15).

### Links

A notification links to the first of these that applies when it is listed:

1. The game page, if the game still exists
2. The archived game, if the user played it (spec 18)
3. The team page, if the team still exists and the user is a member
4. Nothing: the item can still be marked as read

A notification keeps the team and game names it was released with, so it stays readable after they are deleted.

### Live Updates

- When notifications are released, the server signals the room of each recipient (spec 11), and the bell refetches.
- The bell also refetches when it loads, when its socket reconnects, and when the tab regains focus or becomes visible, at most once every 30 seconds.

### Settings

- The profile page has one switch for notifications. It is on by default, for new and existing users.
- While it is off the user receives nothing, and events released in that period are never shown, even after it is turned on again. Notifications already received stay in the list.
- The bell stays visible while it is off.

---

## API

All endpoints require authentication and act only on the caller's own notifications.

- `GET /api/notifications` — `{ notifications, unreadCount }`. Each notification has `id`, `type`, `actorUsername`, `teamName`, `gameName`, `itemCount`, `createdAt`, `read` and `link`. `actorUsername` and `gameName` may be `null`, and `link` is `null` when nothing applies.
- `POST /api/notifications/[id]/read` — marks one notification as read. `404` when the notification does not exist or the caller did not receive it.
- `POST /api/notifications/read-all` — marks all as read.
- `GET /api/notifications/settings` — `{ enabled }`.
- `PUT /api/notifications/settings` — body `{ enabled }`. `400` unless `enabled` is a boolean.

---

## Data Model

| Table | Columns | Notes |
| ----- | ------- | ----- |
| `notification_events` | `id`, `type`, `team_id`, `team_name`, `game_id`, `game_name`, `actor_user_id` (FK → `users.id` ON DELETE SET NULL), `target_user_id` (FK → `users.id` ON DELETE CASCADE), `cell_id`, `item_count`, `created_at`, `published_at` | Pending while `published_at` is `NULL`. `target_user_id` is set for an event with one recipient. |
| `notification_recipients` | `event_id` (FK ON DELETE CASCADE), `user_id` (FK → `users.id` ON DELETE CASCADE), `read_at` | One row per notification received. |
| `notification_settings` | `user_id` (FK → `users.id` ON DELETE CASCADE), `enabled` | No row means on. |

- `team_id`, `game_id` and `cell_id` have no foreign key, and names are stored as plain values: archiving deletes a game right after it ends (spec 18), and a notification must outlive it.
- A pending `card_progress` event has one row per cell. At release the batch collapses into its oldest row, with `item_count` set.
- Only the type is stored, never text.

**Migration:** `V5_5_0__notifications.sql`

---

## Module

`src/lib/notifications/` is self-contained. Application code uses only the `notifications` instance exported by its `index.ts`, which implements the `NotificationPublisher` interface: `publish`, `cancelCell` and `cancelBingo`. Replacing the implementation means changing that one export.

---

## Acceptance Criteria

- A user who was offline sees the unread count on the bell after logging in, and the events in the list.
- An online user's bell updates without a reload, in under 30 seconds after the event.
- Three cells completed by one player in one game within the delay produce one notification with a count of 3.
- A completion undone within the delay produces no notification.
- Actors do not receive their own events.
- A proof request reaches the card owner only.
- A bingo is announced once, even if a proof request clears it and acceptance sets it again.
- `game_ended` survives archiving, and links to the archived game for its players.
- A notification reaches each recipient once, even if the release loop runs again.
- A user with notifications off receives nothing, and sees nothing from that period after turning them on.
- A user cannot read or change another user's notifications, nor join another user's room.
- The notification text renders in English, German and Italian.

---

## Known Gaps

- With more than one Next.js instance, each would run the release loop. Its database lock prevents double delivery, but this was only tested with one instance.
- Notifications are never deleted.

---

## Relation to Other Specs

- **02 — User Profile and Privacy**: hosts the switch.
- **06 — Bingo Gameplay**: defines the cell states.
- **07 — Proof and Approval**: defines proof requests.
- **11 — Real-Time Updates**: defines the user room and the signal.
- **12 — Game Tabs**: defines `first_bingo_at`.
- **14 — Dashboard and Navigation**: hosts the bell.
- **15 — Internationalization**: defines the dictionary section.
- **18 — Game Archive**: explains why notifications hold plain values.
