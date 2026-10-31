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
- Other team members see the change the next time they load the page.
- Live signals are exchanged over WebSocket, and today only two surfaces act on them: an open review thread (spec 07) and an open resolution detail or history dialog (specs 11 and 13).

## Permissions
- Only team members can view team cards. Others receive `403`.

## Acceptance Criteria
- A user can view other team members' cards.
- Non-members cannot access team card data.
- When a member updates their card, other members can see the updated state after reloading.

## Known Gaps
- Cards do not update live for other viewers, although the client broadcasts every change. See spec 11.
