/**
 * TypeScript Types for Database Entities
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { TeamStatus, TeamRole, InvitationStatus, CellSourceType, CellState, ProofStatus, ReviewDecision, DuplicateReportStatus, ThreadStatus, VoteType, ResolutionType, ResolutionScope, Subtask } from "../shared/types";

// Re-export shared enums/types so consumers can import from db/types
export { TeamStatus, TeamRole, InvitationStatus, CellSourceType, CellState, ProofStatus, ReviewDecision, DuplicateReportStatus, ThreadStatus, VoteType, ResolutionType, ResolutionScope };
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
  toUserId: string | null;
  subtasks: Subtask[] | null;
  numberOfRepetition: number | null;
  completedTimes: number;
  createdAt: Date;
  updatedAt: Date;
}

// Team entity
// Spec: 04-bingo-teams.md
export interface Team {
  id: string;
  name: string;
  leaderUserId: string;
  /** Team goal resolution text, derived from the associated resolution entity. */
  teamResolutionText: string | null;
  status: TeamStatus;
  createdAt: Date;
  updatedAt: Date;
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

// Cell proof
// Spec: 07-proof-and-approval.md
export interface CellProof {
  id: string;
  cellId: string;
  fileUrl: string | null;
  comment: string | null;
  status: ProofStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Proof review
// Spec: 07-proof-and-approval.md
export interface ProofReview {
  id: string;
  proofId: string;
  reviewerUserId: string;
  decision: ReviewDecision;
  comment: string | null;
  createdAt: Date;
}

// Duplicate report
// Spec: 05-bingo-card-generation.md
export interface DuplicateReport {
  id: string;
  cellId: string;
  reporterUserId: string;
  replacementText: string | null;
  status: DuplicateReportStatus;
  createdAt: Date;
  resolvedAt: Date | null;
}

// Extended types for API responses

export interface TeamWithMembers extends Team {
  members: TeamMemberWithProfile[];
}

export interface TeamMemberWithProfile {
  membership: TeamMembership;
  user: PublicUserProfile;
}

export interface BingoCardWithCells extends BingoCard {
  cells: BingoCellWithProof[];
}

export interface BingoCellWithProof extends BingoCell {
  proof: CellProof | null;
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

// Team leaderboard entry (persisted)
// Spec: 12-team-tabs.md
export interface TeamLeaderboardEntry {
  userId: string;
  teamId: string;
  firstBingoAt: Date | null;
  completedTasks: number;
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
