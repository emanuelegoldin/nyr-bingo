/**
 * TypeScript Types for Database Entities
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { CellSourceType, CellState, GameStatus, InvitationStatus, ResolutionScope, ResolutionType, Subtask, TeamRole, ThreadStatus, VoteType } from "../shared/types";

// Re-export shared enums/types so consumers can import from db/types
export { CellSourceType, CellState, GameStatus, InvitationStatus, ResolutionScope, ResolutionType, TeamRole, ThreadStatus, VoteType };
export type { Subtask };

// User entity
// Spec: 00-system-overview.md, 01-authentication.md
export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// User profile with privacy settings
// Spec: 02-user-profile-and-privacy.md
export interface UserProfile {
  id: string;
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  displayNamePublic: boolean;
  bioPublic: boolean;
  avatarPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Public view of user profile (respects privacy settings)
export interface PublicUserProfile {
  id: string;
  userId: string;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

// Email verification token
// Spec: 01-authentication.md
export interface EmailVerificationToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

// User session
// Spec: 01-authentication.md
export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// Unified resolution entity
// Spec: 03-personal-resolutions.md, 04-bingo-teams.md, Resolution Rework
export interface Resolution {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  resolutionType: ResolutionType;
  scope: ResolutionScope;
  teamId: string | null;
  /** The game of a team, member-provided or prepared resolution; null for personal ones. */
  gameId: string | null;
  toUserId: string | null;
  subtasks: Subtask[] | null;
  numberOfRepetition: number | null;
  completedTimes: number;
  createdAt: Date;
  updatedAt: Date;
}

export type ResolutionHistoryEntryType = 'manual_note' | 'system_event';

export interface ResolutionHistoryEntry {
  id: string;
  resolutionId: string;
  authorUserId: string;
  authorUsername: string;
  entryType: ResolutionHistoryEntryType;
  eventKey: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ResolutionHistoryAccess {
  resolution: Resolution | null;
  canView: boolean;
  canWrite: boolean;
}

// Team entity
// Spec: 04-bingo-teams.md
export interface Team {
  id: string;
  name: string;
  leaderUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Game entity
// Spec: 16-games.md
export interface Game {
  id: string;
  teamId: string;
  /** Derived from the game's team. */
  teamName: string;
  /** Derived from the game's team: the team leader leads its games. */
  leaderUserId: string;
  name: string;
  /** Team goal resolution text, derived from the associated resolution entity. */
  teamResolutionText: string | null;
  status: GameStatus;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  /** Last playable day as YYYY-MM-DD, or null when the game only ends manually. */
  deadline: string | null;
}

// Team membership
// Spec: 04-bingo-teams.md
export interface TeamMembership {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  joinedAt: Date;
}

// Team invitation
// Spec: 04-bingo-teams.md
export interface TeamInvitation {
  id: string;
  teamId: string;
  inviteCode: string;
  invitedEmail: string | null;
  invitedUserId: string | null;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt: Date;
}

// Bingo card
// Spec: 05-bingo-card-generation.md
export interface BingoCard {
  id: string;
  gameId: string;
  teamId: string;
  userId: string;
  gridSize: number;
  createdAt: Date;
}

// Bingo cell
// Spec: 05-bingo-card-generation.md, 06-bingo-gameplay.md, Resolution Rework
export interface BingoCell {
  id: string;
  cardId: string;
  position: number;
  resolutionId: string | null;
  resolutionType: ResolutionType;
  resolutionText: string;
  resolutionTitle: string;
  isJoker: boolean;
  isEmpty: boolean;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  state: CellState;
  createdAt: Date;
  updatedAt: Date;
}

// Extended types for API responses

export interface TeamWithMembers extends Team {
  members: TeamMemberWithProfile[];
}

export interface GameWithMembers extends Game {
  members: TeamMemberWithProfile[];
}

export interface TeamMemberWithProfile {
  membership: TeamMembership;
  user: PublicUserProfile;
}

export interface BingoCardWithCells extends BingoCard {
  cells: BingoCellWithThread[];
}

export interface BingoCellWithThread extends BingoCell {
  reviewThreadId?: string | null;
}

export interface ReviewThread {
  id: string;
  cellId: string;
  completedByUserId: string;
  status: ThreadStatus;
  createdAt: Date;
  closedAt: Date | null;
}

export interface ReviewMessageAndAuthor {
  id: string;
  authorUsername: string;
  content: string;
}

export interface ReviewFile {
  id: string;
  threadId: string;
  uploadedByUserId: string;
  filePath: string;
  fileSize: number;
  fileName: string;
  mimeType: string | null;
  createdAt: Date;
}

export interface ReviewVote {
  id: string;
  threadId: string;
  voterUserId: string;
  vote: VoteType;
  createdAt: Date;
  updatedAt: Date;
}

// Extended types for API responses

export interface ReviewThreadWithDetails extends ReviewThread {
  messages: ReviewMessageAndAuthor[];
  files: ReviewFile[];
  votes: ReviewVote[];
  cellResolutionText: string;
  teamId: string;
}
