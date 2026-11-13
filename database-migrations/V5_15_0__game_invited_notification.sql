-- V5.15.0 — Game Invited Notification
--
-- Joining a team no longer makes the user a player of every running game: an admin of a game invites
-- team members to it, and the invited member receives a `game_invited` notification.
-- Spec: 16-games.md (Inviting a Player), 19-notifications.md
--
-- Safe to run again: MODIFY with the full value list gives the same column every time. Existing
-- events keep their type.

ALTER TABLE notification_events
  MODIFY type ENUM(
    'card_progress', 'member_joined', 'game_started', 'bingo_scored', 'game_ended', 'proof_requested',
    'game_invited'
  ) NOT NULL;
