# 04 — Bingo Teams

## Purpose

Support groups of users who play bingo together, with invitations and membership, **restricted to verified users only**. A team is a list of users with a leader; the games it plays are defined in spec 16.

---

## User Stories Covered

- Create a team and invite other users
- Join a team when invited
- Delete a team as leader
- Start a new game for a team
- Join a team even after its games have started

---

## In Scope

- Team creation
- Team deletion
- Invitations and joining
- Team membership and roles
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
- The creator becomes the team leader.
- A new team has no games.

`GET /api/teams` lists the caller's teams. `GET /api/teams/[teamId]` returns one team to its members only (`403` otherwise).

---

### Team Page

`/teams/[teamId]` is available to team members only; others get a not-found page. It shows the team name and leader, and:

- The team's running games (spec 16), each linking to its game page
- A **New Game** dialog, for the leader
- The members list, as defined for the game page's Members tab (spec 12)
- The **Invite** dialog and **Delete Team**, for the leader

---

### Team Deletion

`DELETE /api/teams/[teamId]`

- Only the team leader can delete a team (`403` otherwise; `404` when the team does not exist).
- The UI asks for confirmation.
- Deletion is a **hard delete**. Stored proof files of the threads of all its games are removed too, unless another thread uses the same file.
- Due to database `ON DELETE CASCADE` constraints, deleting a team also deletes associated data, including:
  - Team memberships
  - Team invitations
  - All its games, with their goals, member-provided resolutions, leaderboard rows, bingo cards and all dependent gameplay/review records
- Archived games are kept (spec 18).

---

### Invitations / Joining

- Only the team leader can create invitations: `POST /api/teams/[teamId]/invite`.
- An invitation is a shareable link, `/join/<inviteCode>`:
  - It is created on demand from the **Invite** dialog.
  - It expires after **7 days**.
  - It is single-use: the first successful join marks it `accepted`.
- The endpoint accepts an optional `email`, which is stored on the invitation. No email is sent, and the UI does not send one.
- The `/join/[inviteCode]` page has an **Accept Invitation** button that calls `POST /api/join` with `{ inviteCode }`. On success it redirects to the team page.
- Joining requires a logged-in, verified user.
- Joining fails for an invalid, expired or used code, and for a user who is already a member.
- A verified user MAY join a team whose games have started. They receive a card in each started game (spec 16).

---

## Permissions

- Only verified users can participate in teams.
- Only the team leader can:
  - Invite users
  - Create games, and everything spec 16 reserves to the leader
  - Delete the team

---

## Acceptance Criteria

- Verified user can create a team.
- Verified invited users can join, before or after a game starts.
- Unverified users cannot create or join teams.
- A team stays usable for new games without new invitations.
- Team leader can delete their team.
- Non-leaders cannot delete teams.
