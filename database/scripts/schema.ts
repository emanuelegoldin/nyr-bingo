/**
 * Database Schema for Resolution Bingo
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 * 
 * This file contains the SQL schema for MariaDB.
 * Run this manually or use a migration tool to set up the database.
 */

export const schema = `
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE IF NOT EXISTS bingo_cards (
  id varchar(36) NOT NULL,
  team_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  grid_size int(11) DEFAULT 5,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY unique_card (team_id,user_id),
  KEY idx_team (team_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS bingo_cells (
  id varchar(36) NOT NULL,
  card_id varchar(36) NOT NULL,
  position int(11) NOT NULL,
  source_type enum('team','member_provided','personal','empty') NOT NULL,
  source_user_id varchar(36) DEFAULT NULL,
  state enum('pending','completed','pending_review','accomplished') DEFAULT 'pending',
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  resolution_id varchar(36) DEFAULT NULL,
  resolution_type enum('base','compound','iterative') NOT NULL DEFAULT 'base',
  is_empty tinyint(1) GENERATED ALWAYS AS (resolution_id is null and source_type = 'empty') VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY unique_cell (card_id,position),
  KEY source_user_id (source_user_id),
  KEY idx_card (card_id),
  KEY fk_bingo_cells_resolution_id (resolution_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS cell_proofs (
  id varchar(36) NOT NULL,
  cell_id varchar(36) NOT NULL,
  file_url varchar(512) DEFAULT NULL,
  comment text DEFAULT NULL,
  status enum('pending','approved','declined') DEFAULT 'pending',
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_cell (cell_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS duplicate_reports (
  id varchar(36) NOT NULL,
  cell_id varchar(36) NOT NULL,
  reporter_user_id varchar(36) NOT NULL,
  replacement_text varchar(1000) DEFAULT NULL,
  status enum('pending','resolved') DEFAULT 'pending',
  created_at datetime DEFAULT current_timestamp(),
  resolved_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY cell_id (cell_id),
  KEY reporter_user_id (reporter_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  token varchar(255) NOT NULL,
  expires_at datetime NOT NULL,
  used_at datetime DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY token (token),
  KEY user_id (user_id),
  KEY idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS flyway_schema_history (
  installed_rank int(11) NOT NULL,
  version varchar(50) DEFAULT NULL,
  description varchar(200) NOT NULL,
  type varchar(20) NOT NULL,
  script varchar(1000) NOT NULL,
  checksum int(11) DEFAULT NULL,
  installed_by varchar(100) NOT NULL,
  installed_on timestamp NOT NULL DEFAULT current_timestamp(),
  execution_time int(11) NOT NULL,
  success tinyint(1) NOT NULL,
  PRIMARY KEY (installed_rank),
  KEY flyway_schema_history_s_idx (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS proof_reviews (
  id varchar(36) NOT NULL,
  proof_id varchar(36) NOT NULL,
  reviewer_user_id varchar(36) NOT NULL,
  decision enum('approved','declined') NOT NULL,
  comment text DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY reviewer_user_id (reviewer_user_id),
  KEY idx_proof (proof_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS resolutions (
  id varchar(36) NOT NULL,
  owner_user_id varchar(36) NOT NULL,
  title varchar(255) NOT NULL,
  description text DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  resolution_type enum('base','compound','iterative') NOT NULL DEFAULT 'base',
  scope enum('personal','team','member_provided') NOT NULL DEFAULT 'personal',
  team_id varchar(36) DEFAULT NULL,
  to_user_id varchar(36) DEFAULT NULL,
  subtasks longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(subtasks)),
  number_of_repetition int(11) DEFAULT NULL,
  completed_times int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY unique_member_provided (team_id,owner_user_id,to_user_id),
  KEY idx_owner (owner_user_id),
  KEY fk_resolutions_to_user (to_user_id),
  KEY idx_resolutions_team (team_id),
  KEY idx_resolutions_scope (scope),
  KEY idx_resolutions_type (resolution_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS resolution_history_entries (
  id varchar(36) NOT NULL,
  resolution_id varchar(36) NOT NULL,
  author_user_id varchar(36) NOT NULL,
  entry_type enum('manual_note','system_event') NOT NULL,
  event_key varchar(120) DEFAULT NULL,
  content text NOT NULL,
  metadata_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(metadata_json)),
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY idx_resolution_history_resolution_created (resolution_id,created_at),
  KEY idx_resolution_history_author_created (author_user_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS review_files (
  id varchar(36) NOT NULL,
  thread_id varchar(36) NOT NULL,
  uploaded_by_user_id varchar(36) NOT NULL,
  file_path varchar(512) NOT NULL,
  file_size int(11) NOT NULL,
  file_name varchar(255) NOT NULL,
  mime_type varchar(100) DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY uploaded_by_user_id (uploaded_by_user_id),
  KEY idx_thread (thread_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS review_messages (
  id varchar(36) NOT NULL,
  thread_id varchar(36) NOT NULL,
  author_user_id varchar(36) NOT NULL,
  content text NOT NULL,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  KEY author_user_id (author_user_id),
  KEY idx_thread (thread_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS review_threads (
  id varchar(36) NOT NULL,
  cell_id varchar(36) NOT NULL,
  completed_by_user_id varchar(36) NOT NULL,
  status enum('open','closed') DEFAULT 'open',
  created_at datetime DEFAULT current_timestamp(),
  closed_at datetime DEFAULT NULL,
  PRIMARY KEY (id),
  KEY completed_by_user_id (completed_by_user_id),
  KEY idx_cell (cell_id),
  KEY idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS review_votes (
  id varchar(36) NOT NULL,
  thread_id varchar(36) NOT NULL,
  voter_user_id varchar(36) NOT NULL,
  vote enum('accept','deny') NOT NULL,
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY unique_vote (thread_id,voter_user_id),
  KEY voter_user_id (voter_user_id),
  KEY idx_thread (thread_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  token varchar(255) NOT NULL,
  expires_at datetime NOT NULL,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY token (token),
  KEY user_id (user_id),
  KEY idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS teams (
  id varchar(36) NOT NULL,
  name varchar(255) NOT NULL,
  leader_user_id varchar(36) NOT NULL,
  status enum('forming','started') DEFAULT 'forming',
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  KEY leader_user_id (leader_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS team_invitations (
  id varchar(36) NOT NULL,
  team_id varchar(36) NOT NULL,
  invite_code varchar(36) NOT NULL,
  invited_email varchar(255) DEFAULT NULL,
  invited_user_id varchar(36) DEFAULT NULL,
  status enum('pending','accepted','declined','expired') DEFAULT 'pending',
  expires_at datetime NOT NULL,
  created_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY invite_code (invite_code),
  KEY team_id (team_id),
  KEY invited_user_id (invited_user_id),
  KEY idx_code (invite_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS team_leaderboard (
  user_id varchar(36) NOT NULL,
  team_id varchar(36) NOT NULL,
  first_bingo_at datetime DEFAULT NULL,
  completed_tasks int(11) NOT NULL DEFAULT 0,
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  UNIQUE KEY unique_user_team (user_id,team_id),
  KEY idx_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS team_memberships (
  id varchar(36) NOT NULL,
  team_id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  role enum('leader','member') DEFAULT 'member',
  joined_at datetime DEFAULT current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY unique_membership (team_id,user_id),
  KEY idx_team (team_id),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id varchar(36) NOT NULL,
  username varchar(255) NOT NULL,
  email varchar(255) NOT NULL,
  password_hash varchar(255) NOT NULL,
  email_verified_at datetime DEFAULT NULL,
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY username (username),
  UNIQUE KEY email (email),
  KEY idx_email (email),
  KEY idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  id varchar(36) NOT NULL,
  user_id varchar(36) NOT NULL,
  display_name varchar(255) DEFAULT NULL,
  bio text DEFAULT NULL,
  avatar_url varchar(512) DEFAULT NULL,
  display_name_public tinyint(1) DEFAULT 1,
  bio_public tinyint(1) DEFAULT 0,
  avatar_public tinyint(1) DEFAULT 1,
  created_at datetime DEFAULT current_timestamp(),
  updated_at datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_uca1400_ai_ci;


ALTER TABLE bingo_cards
  ADD CONSTRAINT bingo_cards_ibfk_1 FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
  ADD CONSTRAINT bingo_cards_ibfk_2 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE bingo_cells
  ADD CONSTRAINT bingo_cells_ibfk_1 FOREIGN KEY (card_id) REFERENCES bingo_cards (id) ON DELETE CASCADE,
  ADD CONSTRAINT bingo_cells_ibfk_2 FOREIGN KEY (source_user_id) REFERENCES users (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_bingo_cells_resolution_id FOREIGN KEY (resolution_id) REFERENCES resolutions (id) ON DELETE SET NULL;

ALTER TABLE cell_proofs
  ADD CONSTRAINT cell_proofs_ibfk_1 FOREIGN KEY (cell_id) REFERENCES bingo_cells (id) ON DELETE CASCADE;

ALTER TABLE duplicate_reports
  ADD CONSTRAINT duplicate_reports_ibfk_1 FOREIGN KEY (cell_id) REFERENCES bingo_cells (id) ON DELETE CASCADE,
  ADD CONSTRAINT duplicate_reports_ibfk_2 FOREIGN KEY (reporter_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE email_verification_tokens
  ADD CONSTRAINT email_verification_tokens_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE proof_reviews
  ADD CONSTRAINT proof_reviews_ibfk_1 FOREIGN KEY (proof_id) REFERENCES cell_proofs (id) ON DELETE CASCADE,
  ADD CONSTRAINT proof_reviews_ibfk_2 FOREIGN KEY (reviewer_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE resolutions
  ADD CONSTRAINT fk_resolutions_team FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_resolutions_to_user FOREIGN KEY (to_user_id) REFERENCES users (id) ON DELETE CASCADE,
  ADD CONSTRAINT resolutions_ibfk_1 FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE resolution_history_entries
  ADD CONSTRAINT fk_resolution_history_entries_author_user_id FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_resolution_history_entries_resolution_id FOREIGN KEY (resolution_id) REFERENCES resolutions (id) ON DELETE CASCADE;

ALTER TABLE review_files
  ADD CONSTRAINT review_files_ibfk_1 FOREIGN KEY (thread_id) REFERENCES review_threads (id) ON DELETE CASCADE,
  ADD CONSTRAINT review_files_ibfk_2 FOREIGN KEY (uploaded_by_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE review_messages
  ADD CONSTRAINT review_messages_ibfk_1 FOREIGN KEY (thread_id) REFERENCES review_threads (id) ON DELETE CASCADE,
  ADD CONSTRAINT review_messages_ibfk_2 FOREIGN KEY (author_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE review_threads
  ADD CONSTRAINT review_threads_ibfk_1 FOREIGN KEY (cell_id) REFERENCES bingo_cells (id) ON DELETE CASCADE,
  ADD CONSTRAINT review_threads_ibfk_2 FOREIGN KEY (completed_by_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE review_votes
  ADD CONSTRAINT review_votes_ibfk_1 FOREIGN KEY (thread_id) REFERENCES review_threads (id) ON DELETE CASCADE,
  ADD CONSTRAINT review_votes_ibfk_2 FOREIGN KEY (voter_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE teams
  ADD CONSTRAINT teams_ibfk_1 FOREIGN KEY (leader_user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE team_invitations
  ADD CONSTRAINT team_invitations_ibfk_1 FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
  ADD CONSTRAINT team_invitations_ibfk_2 FOREIGN KEY (invited_user_id) REFERENCES users (id) ON DELETE SET NULL;

ALTER TABLE team_leaderboard
  ADD CONSTRAINT team_leaderboard_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  ADD CONSTRAINT team_leaderboard_ibfk_2 FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE;

ALTER TABLE team_memberships
  ADD CONSTRAINT team_memberships_ibfk_1 FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
  ADD CONSTRAINT team_memberships_ibfk_2 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;

ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_ibfk_1 FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE;
COMMIT;
`;

export default schema;
