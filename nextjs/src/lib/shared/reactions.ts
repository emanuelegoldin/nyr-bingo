/**
 * The reaction pool and the shapes of a reaction on a cell, shared by the server and the client.
 * Spec Reference: 24-cell-reactions.md - Reaction Pool
 */

import { CellState } from './types';

/** Ids of the reactions in the pool, in the order the picker shows them. */
export const REACTION_IDS = ['heart', 'thumbs_up', 'fire', 'star', 'smile', 'party'] as const;

/** One reaction of the pool. */
export type ReactionId = (typeof REACTION_IDS)[number];

/** Cell states that can hold reactions: the stamped states (spec 06, Card Display Rules). */
export const REACTABLE_CELL_STATES: readonly CellState[] = [CellState.COMPLETED, CellState.ACCOMPLISHED];

/** Bounds of a reaction's center, in percent of the cell, so the reaction stays inside it. */
export const REACTION_SPOT_MIN = 15;
export const REACTION_SPOT_MAX = 85;

/** Bounds of a reaction's tilt, in degrees around its center. */
export const REACTION_ROTATION_MIN = -45;
export const REACTION_ROTATION_MAX = 45;

/** Bounds of a reaction's size, in percent of the base reaction size. */
export const REACTION_SCALE_MIN = 75;
export const REACTION_SCALE_MAX = 125;

/**
 * A reaction as drawn on a cell: the emoji, the spot of its center in percent, its tilt in
 * degrees and its size in percent of the base size.
 */
export interface CellReactionMark {
  reaction: ReactionId;
  x: number;
  y: number;
  rotation: number;
  scale: number;
}

/** A reaction on a live cell, with the player who put it. */
export interface CellReaction extends CellReactionMark {
  userId: string;
}

/**
 * Check whether a value is a reaction id from the pool.
 *
 * @param value - The value to check, typically from a request body.
 * @returns True when it is one of `REACTION_IDS`.
 */
export const isReactionId = (value: unknown): value is ReactionId =>
  typeof value === 'string' && (REACTION_IDS as readonly string[]).includes(value);
