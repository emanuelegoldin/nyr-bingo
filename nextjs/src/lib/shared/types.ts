// Game status
// Spec: 16-games.md
export enum GameStatus {
  FORMING = 'forming',
  STARTED = 'started',
  ENDED = 'ended'
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
  EMPTY = 'empty',
  PREPARED = 'prepared'
}

// Cell state
// Spec: 06-bingo-gameplay.md, Resolution Review & Proof Workflow
// Bingo cards are a fixed 5x5 grid whose center is the implicit Joker.
// Spec: 00-system-overview.md, 05-bingo-card-generation.md
export const BINGO_GRID_SIZE = 5;
export const JOKER_POSITION = 12;

export enum CellState {
  PENDING = 'pending',
  COMPLETED = 'completed',
  PENDING_REVIEW = 'pending_review',
  ACCOMPLISHED = 'accomplished',
  FAILED = 'failed'
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

// Resolution type discriminator (content type)
// Spec: Resolution Rework — polymorphic resolution types
export enum ResolutionType {
  BASE = 'base',
  COMPOUND = 'compound',
  ITERATIVE = 'iterative',
}

// String form of ResolutionType, for serialized data passed to the frontend
export type ResolutionTypeValue = `${ResolutionType}`;

// Resolution scope (ownership context)
// A resolution can be personal, a team-wide goal, written by one member for another, or a
// prepared resolution copied onto a card as a fallback.
export enum ResolutionScope {
  PERSONAL = 'personal',
  TEAM = 'team',
  MEMBER_PROVIDED = 'member_provided',
  PREPARED = 'prepared',
}

/**
 * Subtask shape stored as JSON in resolutions.subtasks.
 */
export interface Subtask {
  title: string;
  description: string;
  completed: boolean;
}

/**
 * Resolution in the unified list shape returned by GET /api/resolutions/all.
 * Dates are `Date` on the server and ISO strings once serialized to JSON.
 */
export interface UnifiedResolution {
  id: string;
  type: ResolutionTypeValue;
  ownerUserId: string;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
  completedTimes?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// How long a prepared resolution takes
// Spec: 17-prepared-resolutions.md
export enum PreparedResolutionCategory {
  SHORT = 'short',
  MEDIUM = 'medium',
  LONG = 'long',
}

/**
 * An entry of the shared prepared resolutions pool. It has no owner and no progress: users
 * and cards always receive a copy of it.
 */
export interface PreparedResolution {
  id: string;
  category: PreparedResolutionCategory;
  resolutionType: ResolutionType;
  title: string;
  description: string | null;
  subtasks: Subtask[] | null;
  numberOfRepetition: number | null;
}

/** Shape of a resolution passed to the create/edit dialog (matches the unified API response). */
export interface ResolutionFormData {
  id?: string;
  type: ResolutionTypeValue;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
}
