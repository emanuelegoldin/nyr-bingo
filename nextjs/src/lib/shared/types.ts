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
// Bingo cards are a fixed 5x5 grid whose center is the implicit Joker.
// Spec: 00-system-overview.md, 05-bingo-card-generation.md
export const BINGO_GRID_SIZE = 5;
export const JOKER_POSITION = 12;

export enum CellState {
  PENDING = 'pending',
  COMPLETED = 'completed',
  PENDING_REVIEW = 'pending_review',
  ACCOMPLISHED = 'accomplished'
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
// A resolution can be personal, a team-wide goal, or written by one member for another.
export enum ResolutionScope {
  PERSONAL = 'personal',
  TEAM = 'team',
  MEMBER_PROVIDED = 'member_provided',
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

/** Shape of a resolution passed to the create/edit dialog (matches the unified API response). */
export interface ResolutionFormData {
  id?: string;
  type: ResolutionTypeValue;
  title: string;
  text: string;
  subtasks?: Subtask[];
  numberOfRepetition?: number;
}
