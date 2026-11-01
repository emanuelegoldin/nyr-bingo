-- V5.5.0 — Notifications
--
-- Events of a team, held as pending for a short time and then released to their recipients.
-- team_id, game_id and cell_id have no foreign key, and names are plain values: archiving deletes
-- a game right after it ends, and a notification must outlive it. Spec: 19-notifications.md
--
-- Safe to run again: CREATE TABLE IF NOT EXISTS skips a table that already exists.

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ The events                                                        ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- published_at is NULL while the event is pending. A pending card_progress event has one row per
-- cell; at release the batch collapses into its oldest row, with item_count set.
-- target_user_id is set for an event with one recipient, and NULL for one that goes to the team.
CREATE TABLE IF NOT EXISTS notification_events (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('card_progress', 'member_joined', 'game_started', 'bingo_scored', 'game_ended', 'proof_requested') NOT NULL,
  team_id VARCHAR(36) NOT NULL,
  team_name VARCHAR(255) NOT NULL,
  game_id VARCHAR(36) NULL,
  game_name VARCHAR(255) NULL,
  actor_user_id VARCHAR(36) NULL,
  target_user_id VARCHAR(36) NULL,
  cell_id VARCHAR(36) NULL,
  item_count INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at DATETIME NULL,
  CONSTRAINT fk_notification_events_actor FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_notification_events_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notification_events_due (published_at, created_at),
  INDEX idx_notification_events_cell (cell_id),
  INDEX idx_notification_events_bingo (type, game_id, actor_user_id)
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ Who received each event                                           ║
-- ╚═══════════════════════════════════════════════════════════════════╝
CREATE TABLE IF NOT EXISTS notification_recipients (
  event_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  read_at DATETIME NULL,
  PRIMARY KEY (event_id, user_id),
  CONSTRAINT fk_notification_recipients_event FOREIGN KEY (event_id) REFERENCES notification_events(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_recipients_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notification_recipients_user (user_id, read_at)
);

-- ╔═══════════════════════════════════════════════════════════════════╗
-- ║ The setting of each user                                          ║
-- ╚═══════════════════════════════════════════════════════════════════╝
-- No row means notifications are on.
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id VARCHAR(36) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_notification_settings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
