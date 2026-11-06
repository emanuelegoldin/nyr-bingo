# 04 — Bingo Teams

## Purpose

Support groups of users who play bingo together, with invitations and membership, **restricted to verified users only**. A team is a list of users with one or more admins; the games it plays are defined in spec 16.

---

## User Stories Covered

- Create a team and invite other users
- Join a team when invited
- Delete a team as admin
- Start a new game for a team
- Join a team even after its games have started
- Promote another member to admin
- Leave a team

---

## In Scope

- Team creation
- Team deletion
- Invitations and joining
- Team membership and roles
- Promotion to admin
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
- The creator becomes a Team Admin.
- A new team has no games.

`GET /api/teams` lists the caller's teams. `GET /api/teams/[teamId]` returns one team to its members only (`403` otherwise).

`/teams` shows the caller's teams as cards with the team name and its members, and a button to create a team. The whole card is a link to the team page; it has no separate button.

---

### Team Page

`/teams/[teamId]` is available to team members only; others get a not-found page. It shows the team name and its admins, and:

- The team's running games that the caller plays (spec 16), each linking to its game page
- A **New Game** dialog, for admins
- The members list (see below), with **Make Admin** for admins
- The **Invite** dialog and **Delete Team**, for admins
- **Leave Team**, for every member

The members list is a simple list of all team members. The game page has no members list (spec 12).
- Each row contains:
  - **Avatar** on the left (clickable → navigates to the member's profile).
  - **Display name**, or the username when no public display name exists.
  - An "Admin" badge for every Team Admin.
  - A **Make Admin** button for admins on each non-admin row, after confirmation (see Admins).
- The current user's entry is annotated with "(You)".

The header keeps only the most used actions visible, as on the game page (spec 16):
- **New Game** and **Invite** are buttons, for admins.
- The other actions are in a **More actions** menu, opened by a "⋯" button labelled "More actions". Its items, in this order, are Leave Team and Delete Team, which is styled as destructive and listed for admins only.
- Choosing a menu item opens the action's confirmation.

---

### Team Deletion

`DELETE /api/teams/[teamId]`

- Only a Team Admin can delete a team (`403` otherwise; `404` when the team does not exist).
- The UI asks for confirmation.
- Deletion is a **hard delete**. Stored proof files of the threads of all its games are removed too, unless another thread uses the same file.
- Due to database `ON DELETE CASCADE` constraints, deleting a team also deletes associated data, including:
  - Team memberships
  - Team invitations
  - All its games, with their goals, member-provided resolutions, leaderboard rows, bingo cards and all dependent gameplay/review records
- Archived games are kept (spec 18).

---

### Invitations / Joining

- Only a Team Admin can create invitations: `POST /api/teams/[teamId]/invite`.
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

### Admins

- A team has one or more admins: the members whose membership `role` is `leader`. Every admin holds every admin permission.
- The role is shown to users as **Team Admin** (badge: "Admin", action: **Make Admin**). It used to be called "leader": the stored role value `leader`, the `/leaders` route and the code identifiers keep that name, and no data changes.
- `POST /api/teams/[teamId]/leaders` with `{ userId }` makes a member an admin.
  - Only a Team Admin can promote (`403` otherwise; `404` when the team does not exist).
  - The target must be a member who is not already an admin (`400` otherwise).
- The members list of the team page shows **Make Admin** on every non-admin row, for admins. The UI asks for confirmation.
- Promotion cannot be undone: an admin stops being one only by leaving the team.

---

### Leaving a Team

`POST /api/teams/[teamId]/leave`

- Only a member can leave (`403` otherwise; `404` when the team does not exist).
- An admin cannot leave while they are the team's only admin, or the only admin among the players of a running game they play (`400` otherwise). They promote another member first.
- Leaving a team leaves each of its running games the user plays, with the effects of spec 16 (Leaving a Game), then removes the membership.
- Resolutions the user wrote for other players stay on their cards, tagged "Former Teammates" (spec 05).
- The UI asks for confirmation and then returns the user to `/teams`.
- A user who left can join again through a new invitation, as a new member (spec 16).

---

## Permissions

The role-to-permission table and the status of every refusal are defined in spec 21 (Authorization).

- Only verified users can participate in teams.
- Only a Team Admin can:
  - Invite users
  - Promote members to admin
  - Create games, and everything spec 16 reserves to the admin
  - Delete the team
- Every member can leave the team, under the rules above.

---

## Acceptance Criteria

- Verified user can create a team.
- Verified invited users can join, before or after a game starts.
- Unverified users cannot create or join teams.
- A team stays usable for new games without new invitations.
- Team Admin can delete their team.
- Non-admins cannot delete teams.
- A Team Admin can promote a member; a team can have several admins.
- A member can leave a team after confirming; this leaves all of its running games they play.
- The only admin cannot leave until another member is promoted.
- An admin's team header shows at most two action buttons plus the More actions menu, and every Team Page action can be reached from the header or the menu.
