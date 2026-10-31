# 08 — Visibility and Updates

## Purpose
Let users view other users' bingo cards in the same competition context, and define how card changes reach other users.

## User Stories Covered
- See my card state and other users' cards for users competing with me

## In Scope
- Viewing other users' bingo cards (within a team)
- Propagating updates when card state changes

## Functional Requirements
### Visibility
- A team member can view the bingo cards of every member in the same team on the team page's Cards tab.
- `GET /api/teams/[teamId]/cards` returns all cards of the team. With `?userId=<id>` it returns that member's card.
- The dashboard shows only the current user's own cards (spec 14).
- Cards are labeled with the username, which is always public.

### Updates
- When a user changes a cell, that user's own card reloads from the API.
- The team page and dashboard update without a reload when the server signals a team change: cards, leaderboard, members, team status and goal (spec 11). Open review threads (spec 07) and resolution dialogs (specs 11 and 13) update the same way.
- `/resolutions` and profile pages have no WebSocket and update on load.

## Permissions
- Only team members can view team cards. Others receive `403`.

## Acceptance Criteria
- A user can view other team members' cards.
- Non-members cannot access team card data.
- When a member updates their card, other members viewing the team page see the updated state without reloading.
