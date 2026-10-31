# 10 — Voting Mechanic

## Purpose

Define the UI behaviour and data flow for the **review-thread voting system**.
This specification governs the `VoteBar` component and its interaction with the
back-end voting API. General thread lifecycle rules remain in
**07-proof-and-approval.md**; this document focuses on the **presentation,
persistence, and interaction details** of the voting UI.

---

## Component: `VoteBar`

Located at `src/components/dialogs/vote-bar.tsx`.

### Props

| Prop              | Type              | Description                                                             |
| ----------------- | ----------------- | ----------------------------------------------------------------------- |
| `threadId`        | `string`          | Review thread ID used in vote API calls.                                |
| `votes`           | `ReviewVote[]`    | Snapshot of all current votes on the thread.                            |
| `currentUserId`   | `string \| null`  | Authenticated user's ID — used to highlight their own vote.             |
| `threadOpen`      | `boolean`         | Whether the thread is still open.                                       |
| `canVote`         | `boolean`         | Optional, default `true`. When `false` the vote buttons are not shown.  |
| `onVoteSubmitted` | `() => void`      | Optional callback fired after a vote is persisted.                      |

### Rendering Rules

- **The component is rendered for every viewer of the thread.** The parent
  (`CellThreadDialog`) passes `canVote={!isOwner}`, so the card owner sees the
  results bar without the buttons. The heading reads "Vote" for voters and
  "Votes" for the card owner.
- When `threadOpen` is `false`, the vote buttons are disabled but the results
  bar and any previously cast vote remain visible.

---

## Vote Buttons

Two buttons: **Accept** and **Deny**.

### Visual Behaviour

| State               | Accept button                                  | Deny button                                  |
| -------------------- | ---------------------------------------------- | -------------------------------------------- |
| Default (no vote)    | Outline style                                  | Outline style                                |
| Hover                | Light green background (`green-100`)           | Light red background (`red-100`)             |
| Pressed / Active     | Slightly deeper green (`green-200`)            | Slightly deeper red (`red-200`)              |
| **Selected** (voted) | Solid green (`green-600`), white text           | Solid red (`red-600`), white text            |
| Disabled (closed)    | Standard disabled appearance                    | Standard disabled appearance                 |

### Interaction

- Clicking a button submits (or updates) the user's vote via
  `POST /api/threads/[threadId]/vote`.
- A user **may change their vote** as long as the thread is open (spec 07 §
  Eligible Voters).
- After a successful vote, the `onVoteSubmitted` callback refreshes the thread
  so the votes array — and therefore the button state — is updated.
- A vote that is rejected by the API or fails to reach it shows an error toast.

---

## Results Bar

A horizontal bar displayed below the buttons.

### Layout

- Full width, rounded, fixed height (`h-5`).
- **Left portion** — green (`green-500`) — represents the *accept* share.
- **Right portion** — red (`red-500`) — represents the *deny* share.
- Each portion displays its rounded percentage as a small label. A portion with
  no votes shows `0%`.

### Empty State

- When **no votes** have been cast, the bar is solid grey (`gray-300`) with a
  centred "No votes yet" label.

### Accessibility

- `role="progressbar"` with `aria-label`, `aria-valuenow`, `aria-valuemin`,
  `aria-valuemax` attributes. `aria-valuenow` is the accept percentage.

---

## Data Flow

```
User clicks Accept/Deny
        │
        ▼
POST /api/threads/[threadId]/vote  ──▶  submitVote() (DB)
        │
        ▼
   onVoteSubmitted()
        │
        ├──▶ WS thread-refresh  ──▶  other thread viewers refetch
        ├──▶ refetchThread()    ──▶  GET /api/threads/[threadId]
        │                            VoteBar re-renders with updated votes[]
        └──▶ onRefresh()        ──▶  card reload + WS card-refresh
```

Votes are **persisted server-side** in the `review_votes` table (unique
constraint on `(thread_id, voter_user_id)`). The `ON DUPLICATE KEY UPDATE`
clause handles vote changes transparently.

---

## Persistence & Database Notes

The `review_votes` table stores votes:

```sql
CREATE TABLE review_votes (
  id           VARCHAR(36) PRIMARY KEY,
  thread_id    VARCHAR(36) NOT NULL,
  voter_user_id VARCHAR(36) NOT NULL,
  vote         ENUM('accept', 'deny') NOT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_vote (thread_id, voter_user_id),
  …
);
```

These columns:

- Store one vote per user per thread.
- Allow vote changes (`ON DUPLICATE KEY UPDATE`).
- Return all votes with their voter IDs for the results bar.

---

## Relationship to Other Specs

- **07-proof-and-approval.md** — defines thread lifecycle, eligible voters,
  automatic closure, and outcome rules. The VoteBar implements the *client-side*
  of those rules; the server-side enforcement lives in
  `review-thread-repository.ts → submitVote()`.
- **00-system-overview.md** — high-level mention of voting as part of the review
  workflow.

---

## Out of Scope

- Server-side vote validation (already covered in spec 07).
- Thread closure logic (covered in spec 07).
- Notification of voting outcome.
