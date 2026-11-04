# 04 — Bingo Teams

## Purpose

Support groups of users who play bingo together, with invitations and membership, **restricted to verified users only**. A team is a list of users with one or more leaders; the games it plays are defined in spec 16.

---

## User Stories Covered

- Create a team and invite other users
- Join a team when invited
- Delete a team as leader
- Start a new game for a team
- Join a team even after its games have started
- Promote another member to leader
- Leave a team

---

## In Scope

- Team creation
- Team deletion
- Invitations and joining
- Team membership and roles
- Promotion to leader
- Leaving a team
- Team page
- Verification-based access restrictions

---

## Functional Requirements

### Verification Requirement

Unverified users:
- Cannot create teams
- Cannot join teams
- Cannot accept invitations
- Cannot create or start bingo games

These checks are server-side (see spec 01). Team pages do not hide these actions; the API response is shown as an error.

---

### Team Creation

`POST /api/teams`

- A verified user can create a team by providing a non-empty name.
- The creator becomes a team leader.
- A new team has no games.

`GET /api/teams` lists the caller's teams. `GET /api/teams/[teamId]` returns one team to its members only (`403` otherwise).

---

### Team Page

`/teams/[teamId]` is available to team members only; others get a not-found page. It shows the team name and its leaders, and:

- The team's running games that the caller plays (spec 16), each linking to its game page
- A **New Game** dialog, for leaders
- The members list, as defined for the game page's Members tab (spec 12), with **Make Leader** for leaders
- The **Invite** dialog and **Delete Team**, for leaders
- **Leave Team**, for every member

---

### Team Deletion

`DELETE /api/teams/[teamId]`

- Only a team leader can delete a team (`403` otherwise; `404` when the team does not exist).
- The UI asks for confirmation.
- Deletion is a **hard delete**. Stored proof files of the threads of all its games are removed too, unless another thread uses the same file.
- Due to database `ON DELETE CASCADE` constraints, deleting a team also deletes associated data, including:
  - Team memberships
  - Team invitations
  - All its games, with their goals, member-provided resolutions, leaderboard rows, bingo cards and all dependent gameplay/review records
- Archived games are kept (spec 18).

---

### Invitations / Joining

- Only a team leader can create invitations: `POST /api/teams/[teamId]/invite`.
- An invitation is a shareable link, `/join/<inviteCode>`:
  - It is created on demand from the **Invite** dialog.
  - It expires after **7 days**.
  - It is single-use: the first successful join marks it `accepted`.
- The endpoint accepts an optional `email`, which is stored on the invitation. No email is sent, and the UI does not send one.
- The `/join/[inviteCode]` page has an **Accept Invitation** button that calls `POST /api/join` with `{ inviteCode }`. On success it redirects to the team page.
- Joining requires a logged-in, verified user.
- Joining fails for an invalid, expired or used code, and for a user who is already a member.
- A verified user MAY join a team whose games have started. They become a player of each running game and receive a card in each started game (spec 16).

---

### Leaders

- A team has one or more leaders: the members whose membership `role` is `leader`. Every leader holds every leader permission.
- `POST /api/teams/[teamId]/leaders` with `{ userId }` makes a member a leader.
  - Only a team leader can promote (`403` otherwise; `404` when the team does not exist).
  - The target must be a member who is not already a leader (`400` otherwise).
- The members list of the team page shows **Make Leader** on every non-leader row, for leaders. The UI asks for confirmation.
- Promotion cannot be undone: a leader stops being one only by leaving the team.

---

### Leaving a Team

`POST /api/teams/[teamId]/leave`

- Only a member can leave (`403` otherwise; `404` when the team does not exist).
- A leader cannot leave while they are the team's only leader, or the only leader among the players of a running game they play (`400` otherwise). They promote another member first.
- Leaving a team leaves each of its running games the user plays, with the effects of spec 16 (Leaving a Game), then removes the membership.
- Resolutions the user wrote for other players stay on their cards, tagged "Former Teammates" (spec 05).
- The UI asks for confirmation and then returns the user to `/teams`.
- A user who left can join again through a new invitation, as a new member (spec 16).

---

## Permissions

- Only verified users can participate in teams.
- Only a team leader can:
  - Invite users
  - Promote members to leader
  - Create games, and everything spec 16 reserves to the leader
  - Delete the team
- Every member can leave the team, under the rules above.

---

## Acceptance Criteria

- Verified user can create a team.
- Verified invited users can join, before or after a game starts.
- Unverified users cannot create or join teams.
- A team stays usable for new games without new invitations.
- Team leader can delete their team.
- Non-leaders cannot delete teams.
- A team leader can promote a member; a team can have several leaders.
- A member can leave a team after confirming; this leaves all of its running games they play.
- The only leader cannot leave until another member is promoted.
