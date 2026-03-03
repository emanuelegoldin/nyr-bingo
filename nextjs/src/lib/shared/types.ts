// Team status
// Spec: 04-bingo-teams.md
export enum TeamStatus {
  FORMING = 'forming',
  STARTED = 'started'
}

// Team membership role
// Spec: 04-bingo-teams.md
export enum TeamRole {
  LEADER = 'leader',
  MEMBER = 'member'
}

// Team invitation status
// Spec: 04-bingo-teams.md
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired'
}

// Cell source type
// Spec: 05-bingo-card-generation.md
export enum CellSourceType {
  TEAM = 'team',
  MEMBER_PROVIDED = 'member_provided',
  PERSONAL = 'personal',
  EMPTY = 'empty'
}

// Cell state
// Spec: 06-bingo-gameplay.md, Resolution Review & Proof Workflow
export enum CellState {
  PENDING = 'pending',
  COMPLETED = 'completed',
  PENDING_REVIEW = 'pending_review',
  ACCOMPLISHED = 'accomplished'
}

// Proof status
// Spec: 07-proof-and-approval.md, AGENTS.md
export enum ProofStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DECLINED = 'declined'
}

// Proof review decision
// Spec: 07-proof-and-approval.md
export enum ReviewDecision {
  APPROVED = 'approved',
  DECLINED = 'declined'
}

// Duplicate report status
// Spec: 05-bingo-card-generation.md
export enum DuplicateReportStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved'
}

// Review thread types
// Spec: Resolution Review & Proof Workflow
export enum ThreadStatus {
  OPEN = 'open', 
  CLOSED = 'closed'
}

export enum VoteType {
  ACCEPT = 'accept',
  DENY = 'deny'
}

// Resolution type discriminator
// Spec: Resolution Rework — polymorphic resolution types
export enum ResolutionType {
  BASE = 'base',
  TEAM = 'team',
  COMPOUND = 'compound',
  ITERATIVE = 'iterative',
}

/**
 * Subtask shape stored as JSON in compound_resolutions.subtasks.
 */
export interface Subtask {
  title: string;
  description: string;
  completed: boolean;
}

// --- Discriminated union for typed resolutions (frontend consumption) ---

export interface BaseResolution {
  type: 'base';
  id: string;
  title: string;
  description: string;
  ownerUserId: string;
}

export interface CompoundResolution {
  type: 'compound';
  id: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  subtasks: Subtask[];
  completedTasks: number;
  numberOfTasks: number;
}

export interface IterativeResolution {
  type: 'iterative';
  id: string;
  title: string;
  description: string | null;
  ownerUserId: string;
  numberOfRepetition: number;
  completedTimes: number;
}

export interface TeamResolution {
  type: 'team';
  id: string;
  title: string;
  description: string;
  teamId?: string;
  fromUserId?: string;
  toUserId?: string;
}

/**
 * Discriminated union for all resolution types.
 * Use the `type` field to narrow the specific variant.
 */
export type TypedResolution =
  | BaseResolution
  | CompoundResolution
  | IterativeResolution
  | TeamResolution;