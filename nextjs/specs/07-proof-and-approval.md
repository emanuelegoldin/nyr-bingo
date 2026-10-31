# 07 — Proof and Approval

## Purpose

Enable team-based verification of completed resolutions through a structured **Resolution Review** process that includes proof submission, discussion, and voting.

This specification governs **proof, review, and approval workflows**, not basic bingo gameplay.

---

## User Stories Covered

- Request proof for another team member's completed resolution
- Upload proof files for a completed resolution
- Discuss proof in a review thread
- Vote to accept or deny proof
- Close my own review thread and revert my resolution
- See resolution automatically finalized or reverted based on votes or a deadline

---

## In Scope

- Proof request initiation
- Review thread lifecycle
- Messaging and file uploads
- Voting and automatic state transitions
- Deadline-based closure
- Cleanup of review data upon completion or cancellation

---

## Review Trigger

`POST /api/cells/[cellId]/request-proof`

- Proof review is **not automatic**.
- A review begins only when:
  - The cell is in `completed` state
  - A **different team member** explicitly requests proof
  - No open thread exists for that cell

Requesting proof:
- Creates a **Review Thread**
- Transitions the cell to `pending_review`

---

## Review Thread Model

Each review thread is associated with:
- One bingo cell
- The card owner, as the completing user (`completed_by_user_id`)

A cell's `reviewThreadId` is only set while a thread is open. Once a thread closes it can no longer be reached from the card, and a cell that returns to `completed` can have a new thread.

### Thread Status

- `open`
- `closed`

`GET /api/threads/[threadId]` returns the thread with its messages, files and votes.

---

## Proof Submission

### Completing User

- May upload proof files to the review thread: `POST /api/threads/[threadId]/files`.
- May delete their uploaded files from an open thread: `DELETE /api/threads/[threadId]/files` with `{ fileId }`.
- May write messages explaining or clarifying proof.
- May close the thread (see below).
- Cannot vote.

### File Constraints

- Maximum file size: **5MB per file**. Nginx limits request bodies to 6MB.
- Accepted types: JPEG, PNG, WebP, GIF, PDF, MP4 and QuickTime.
- Images other than WebP are converted to WebP when possible; the original is kept if conversion fails.
- Files are stored under `uploads/review-files/` with a content-addressed name, and served by Nginx at `/review-files/` with `X-Content-Type-Options: nosniff`.
- The stored extension comes from the validated file type, never from the uploaded file name.
- Identical uploads share one stored file, which is removed only when no other review file references it.

---

## Discussion

`POST /api/threads/[threadId]/messages`

- All team members may post non-empty messages while the thread is open.

### Real-time Updates (WebSocket)

Thread changes are signaled in real time to other users viewing the same review thread.

- **Persistence remains HTTP-first**: the API writes to MariaDB and stays the source of truth.
- **Realtime fanout is WebSocket-based**: after a successful change the client sends a minimal WS message so other viewers refetch.
- The review dialog opens its own connection while it is open.

#### Room Model

- Each review thread is a **room**. The room id is the `threadId`.

#### WebSocket URL

- The client connects to `ws(s)://<current-host>/ws`.

#### WebSocket Messages

- `join-thread` (client → server): joins the socket to a thread room.
  - Body: `{ threadId: string }`
- `thread-refresh` (client → server): indicates that the thread changed.
  - Body: `{ threadId: string }`
- `refresh-thread` (server → other sockets in the room): carries no thread data.

Clients send `thread-refresh` after posting a message, uploading or deleting a file, voting and closing the thread. On receipt, clients refetch `GET /api/threads/[threadId]`.

---

## Voting & Approval

`POST /api/threads/[threadId]/vote` with `{ vote: 'accept' | 'deny' }`

### Eligible Voters

- All team members **except** the completing user, as of the moment of the vote.
- Each voter has one vote per thread.
- Votes can be changed until thread closure.

### Vote Types

- `accept`
- `deny`

### Voting Rules

- The thread closes automatically once every eligible voter has voted.

#### Outcome

Computed as `accept votes / total votes`:

- **≥ 50% accept**
  - Cell transitions to `accomplished`

- **< 50% accept**
  - Cell rolls back to `pending`

The API responds with the vote and a `threadClosed` flag.

---

## Closure by the Completing User

`DELETE /api/threads/[threadId]`

- Only the completing user can close an open thread, from the **Close Thread** button after a confirmation.
- The cell returns to `pending`.

---

## Closure by Deadline

The migration `V4_0_0` defines the `CloseThreads` procedure and the daily `CloseThreadsEvent` MariaDB event.

- It closes every open thread whose cell still references a resolution, for which `CURDATE() > created_at + 2 days`.
- The cell becomes `accomplished` when any of these holds, and `pending` otherwise:
  - Accept votes ≥ `FLOOR(team members / 2)`
  - No votes were cast
  - Accept votes ≥ deny votes
- On `accomplished` it updates the leaderboard directly (spec 12).

---

## Thread Closure & Cleanup

| | All votes in | Completing user closes | Undo completion | Deadline |
| - | - | - | - | - |
| Thread status | `closed` | `closed` | `closed` | `closed` |
| `closed_at` set | Yes | Yes | Yes | No |
| Cell state | `accomplished` or `pending` | `pending` | `pending` | `accomplished` or `pending` |
| Messages deleted | Yes | Yes | Yes | Yes |
| File rows deleted | Yes | Yes | Yes | Yes |
| Files deleted from disk | Yes | Yes | **No** | **No** |

The thread row and its votes are kept in every case.

If a file cannot be removed from disk during an all-votes or completing-user closure, the closure fails and the thread stays open.

---

## Permissions & Security

- Only team members may access review threads, post messages or vote.
- Only the completing user may upload or delete proof files, and only while the thread is open.
- Completing user is blocked from voting.
- Duplicate votes per user are prevented by a unique key on `(thread_id, voter_user_id)`.
- Closed threads accept no messages, files or votes.

---

## Acceptance Criteria

- Proof review threads are created only when explicitly requested.
- Completing users can upload proof and participate in discussion.
- Other team members can vote and discuss.
- Votes can be changed before closure.
- Cell state updates correctly based on voting outcome.
- Messages and file records are deleted when threads close.

---

## Out of Scope

- UI styling and layout
- Notifications
- File preview

---

## Notes

- Proof review is **collaborative, explicit, and vote-driven**.
- Declines do not require a dedicated comment field; discussion occurs in the thread.

---

## Known Gaps

- No file in the repository enables MariaDB's `event_scheduler`, which is off by default. Unless it is enabled on the server, `CloseThreadsEvent` never runs and threads have no deadline.
- Deleting a resolution while its cell is under review leaves the cell without a reference, so the deadline procedure never picks up that thread.
- Undo and deadline closure leave proof files on disk with no database record of them.
- The deadline rule differs from the voting rule: a thread with no votes is accepted.
- `/review-files/` is served by Nginx without authentication. Access control relies on the file name being unguessable.
- Editing a cell's content does not close an open thread on that cell (spec 09).
- Vote, message and file authorization failures return `400`, not `403`.
