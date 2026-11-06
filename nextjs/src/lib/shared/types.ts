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
// Bingo cards are an N x N grid whose center is the implicit Joker. N is chosen per game.
// Spec: 05-bingo-card-generation.md - Assumptions, 16-games.md - Game Model
/** The card sizes a game can be created with. */
export const GRID_SIZES = [3, 5, 9] as const;
/** The side length of a game's cards: 3, 5 or 9. */
export type GridSize = (typeof GRID_SIZES)[number];
/** The size of a game created without one. */
export const DEFAULT_GRID_SIZE: GridSize = 5;

/**
 * Whether a value is one of the allowed card sizes.
 * @param value The value to check, for example a request field
 * @returns True for 3, 5 or 9
 */
export function isGridSize(value: unknown): value is GridSize {
  return GRID_SIZES.some((size) => size === value);
}

/**
 * The position of the Joker, the center cell of the grid.
 * @param gridSize The side length of the card
 * @returns 4 for 3x3, 12 for 5x5, 40 for 9x9
 */
export function getJokerPosition(gridSize: number): number {
  return (gridSize * gridSize - 1) / 2;
}

export enum CellState {
  PENDING = 'pending',
  COMPLETED = 'completed',
  PENDING_REVIEW = 'pending_review',
  ACCOMPLISHED = 'accomplished',
  FAILED = 'failed'
}

/** Spec: 22-card-shuffle.md - States of a done cell. A card with one cannot be shuffled. */
export const DONE_CELL_STATES: readonly CellState[] = [
  CellState.COMPLETED,
  CellState.PENDING_REVIEW,
  CellState.ACCOMPLISHED,
];

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

/**
 * Where a cell's resolution came from, as data the browser turns into text (spec 15):
 * a member's name, or one of the fixed sources.
 */
export type CellSourceLabel =
  | { kind: 'team' | 'prepared' | 'personal' | 'formerTeammates' }
  | { kind: 'member'; name: string };

// Resolution scope (ownership context)
// A resolution can be personal, a team-wide goal, written by one member for another, or a
// prepared resolution copied onto a card as a fallback.
export enum ResolutionScope {
  PERSONAL = 'personal',
  TEAM = 'team',
  MEMBER_PROVIDED = 'member_provided',
}

/**
 * Subtask of a compound resolution's definition, stored as JSON in resolutions.subtasks.
 * Spec: 03-personal-resolutions.md - a resolution holds no progress
 */
export interface Subtask {
  title: string;
  description: string;
}

/**
 * Subtask of a compound cell: the cell's copy of the definition, with its progress.
 * Spec: 06-bingo-gameplay.md - progress lives on the cell
 */
export interface CellSubtask extends Subtask {
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

// Archived games: read-only snapshots of finished games, stored as plain values
// Spec: 18-game-archive.md

/** One cell of an archived card. The field names match the live cell where they overlap. */
export interface ArchivedCell {
  position: number;
  isJoker: boolean;
  isEmpty: boolean;
  resolutionTitle: string;
  resolutionText: string;
  resolutionType: ResolutionType;
  state: CellState;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  sourceLabel: CellSourceLabel;
  subtasks: CellSubtask[] | null;
  numberOfRepetition: number | null;
  completedTimes: number | null;
}

/** One player's card in an archived game. */
export interface ArchivedCard {
  userId: string;
  playerName: string;
  cells: ArchivedCell[];
}

/** One line of a game's leaderboard, live or archived. */
export interface LeaderboardEntry {
  userId: string;
  username: string;
  displayName: string | null;
  firstBingoAt: string | null;
  completedTasks: number;
}

/**
 * One stored value of a player's completed count, live or archived.
 * Spec: 23-progress-chart.md - Recording Progress
 */
export interface ProgressPoint {
  userId: string;
  /** ISO datetime from which the count held this value. */
  recordedAt: string;
  completedTasks: number;
}

/** An archived game as listed on the archive page. */
export interface ArchivedGameSummary {
  id: string;
  name: string;
  teamName: string;
  endedAt: string;
}

/** An archived game with its leaderboard, cards and archived threads. */
export interface ArchivedGameDetail extends ArchivedGameSummary {
  /** The side length of every card of the game. */
  gridSize: number;
  /** ISO datetime bingo started, or null for games archived before it was recorded. */
  startedAt: string | null;
  leaderboard: LeaderboardEntry[];
  cards: ArchivedCard[];
  threads: ArchivedThread[];
  /** The players' progress points, oldest first (spec 23). */
  progress: ProgressPoint[];
}

// Archived threads: closed review threads, read-only, of a running or an archived game
// Spec: 07-proof-and-approval.md - Archived Threads, 18-game-archive.md

/** The state a thread's cell took when the thread closed. */
export type ThreadOutcome = 'accomplished' | 'pending';

/** One message of an archived thread. */
export interface ArchivedThreadMessage {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

/** One proof file of an archived thread, as a link. */
export interface ArchivedThreadFile {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string | null;
}

/** A closed review thread with everything it keeps. */
export interface ArchivedThread {
  id: string;
  /** The card owner, who is also the completing user. */
  cardOwnerId: string;
  cardOwnerName: string;
  cellPosition: number;
  cellTitle: string;
  createdAt: string;
  closedAt: string | null;
  /** Null for threads closed before the outcome was recorded. */
  outcome: ThreadOutcome | null;
  acceptVotes: number;
  denyVotes: number;
  messages: ArchivedThreadMessage[];
  files: ArchivedThreadFile[];
}
