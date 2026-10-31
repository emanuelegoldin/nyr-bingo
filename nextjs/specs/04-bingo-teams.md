# 04 — Bingo Teams

## Purpose

Support team-based bingo gameplay with invitations, membership, and shared resolutions, **restricted to verified users only**.

---

## User Stories Covered

- Create a team and invite other users
- Join a team when invited
- Delete a team as leader
- Define a team goal
- Create resolutions for other team members
- Start bingo once setup is complete
- Join a team even after the game has started
- Update member-provided resolutions at any time

---

## In Scope

- Team creation
- Team deletion
- Invitations and joining
- Team membership and roles
- Team goal definition
- Member-provided resolutions
- Bingo start conditions
- Joining after game start
- Ongoing member-provided resolutions after game start
- Verification-based access restrictions

---

## Functional Requirements

### Verification Requirement

Unverified users:
- Cannot create teams
- Cannot join teams
- Cannot accept invitations
- Cannot start bingo games

These checks are server-side (see spec 01). Team pages do not hide these actions; the API response is shown as an error.

---

### Team Creation

`POST /api/teams`

- A verified user can create a team by providing a non-empty name.
- The creator becomes the team leader.
- The team starts in `forming` status.

`GET /api/teams` lists the caller's teams. `GET /api/teams/[teamId]` returns one team to its members only (`403` otherwise). `GET /api/teams/[teamId]/members` returns a `userId → username` map to members only.

---

### Team Deletion

`DELETE /api/teams/[teamId]`

- Only the team leader can delete a team (`403` otherwise; `404` when the team does not exist).
- The UI asks for confirmation.
- Deletion is a **hard delete**.
- Due to database `ON DELETE CASCADE` constraints, deleting a team also deletes associated data, including:
  - Team memberships
  - Team invitations
  - Team goal and member-provided resolutions
  - Leaderboard rows
  - Bingo cards and all dependent gameplay/review records

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

#### Joining After Start

- A verified user MAY join a team after its status is `started`.
- If a user joins a team after it has started:
  - The team remains in `started` status.
  - The new member receives a bingo card, generated at join time under the rules of spec 05. This requires the team goal to still exist; a failure to generate the card is not reported to the user.
  - If the team goal is `compound` or `iterative`, the new member's goal cell is set to match the goal's progress.
  - Existing members' cards are not regenerated.

---

### Team Goal

- The team goal is a resolution with `scope = team`, of any type (spec 03).
- Only the team leader can create or edit it: `POST /api/resolutions/save` with `scope = 'team'` and `teamId`.
- A team has one goal. Saving a new goal without an `id` when one already exists updates the existing goal, keeping its stored type (spec 03).
- The goal can be edited at any time, including after the game has started. Cells reference it, so edits are reflected on every card.
- `GET /api/teams/[teamId]/goal` returns it to team members.
- The goal is shown on the team page and appears as a normal `team` cell on the cards (spec 05). It is **not** the Joker.

---

### Member-Provided Resolutions

- For each team, each member is expected to create one resolution for every **other** member.
- `POST /api/resolutions/save` with `scope = 'member_provided'`, `teamId` and `toUserId`. Any type is allowed.
- Rules:
  - The author and the target must both be team members.
  - Members cannot create a resolution for themselves.
- The team page's **Propose Resolutions** dialog lists every other member with their resolution, if any.
- `GET /api/teams/[teamId]/resolutions` returns the caller's written and received resolutions, the members and the overall status. With `?toUserId=<id>` it returns the resolutions targeted to that member. Both are limited to team members.

#### Ongoing Updates

- Team members MAY create or update their member-provided resolutions at any time, before or after game start.
- There is at most one resolution per `(team_id, owner_user_id, to_user_id)`; saving again overwrites it, keeping its stored type unless the save is a type change (spec 03). Cells reference resolutions by id, so edits are reflected on the card.
- A resolution created after the recipient's card was generated is not added to that card automatically. The recipient can place it through card editing (spec 09).

#### New Member Effects

- The requirement to provide resolutions for every other member is only evaluated at game start. After the game has started, nothing enforces resolutions for or from a new member.

---

### Start Conditions

`POST /api/teams/[teamId]/start`

The team leader may start bingo only when:
- The leader is verified
- The team is in `forming` status
- The team goal is set
- Every member has provided a resolution for every other member (trivially true for a one-person team)

Other members are verified because joining requires it.

On start:
- Team status becomes `started` and a bingo card is generated for every member (spec 05), in one transaction: if generation fails, the team stays `forming` with no cards
- A leaderboard row is created for every member (spec 12)

---

## Permissions

- Only verified users can participate in teams.
- Only the team leader can:
  - Invite users
  - Define the team goal
  - Start the bingo game
  - Delete the team
- Team members can:
  - Provide resolutions for other members

---

## Acceptance Criteria

- Verified user can create a team.
- Verified invited users can join, before or after the game starts.
- Unverified users cannot create or join teams, or start a game.
- Team leader can define the team goal.
- Bingo cannot start until the team goal and all required resolutions exist.
- Team leader can delete their team.
- Non-leaders cannot delete teams.

---

## Known Gaps

- A user who joins after the game has started gets a card built only from resolutions that exist at that moment, normally the team goal plus personal resolutions and empty cells.
- The team goal dialog says the goal appears "in the center of everyone's bingo card", which no longer matches the card layout.
