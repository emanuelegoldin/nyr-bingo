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