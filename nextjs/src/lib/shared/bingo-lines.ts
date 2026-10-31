import { BINGO_GRID_SIZE, JOKER_POSITION } from './types';

/**
 * Build the positions of every row, column and diagonal of the grid.
 *
 * @returns One array of positions per line.
 */
function buildLines(): number[][] {
  const positions = Array.from({ length: BINGO_GRID_SIZE }, (_, index) => index);
  return [
    ...positions.map((row) => positions.map((col) => row * BINGO_GRID_SIZE + col)),
    ...positions.map((col) => positions.map((row) => row * BINGO_GRID_SIZE + col)),
    positions.map((index) => index * BINGO_GRID_SIZE + index),
    positions.map((index) => index * BINGO_GRID_SIZE + (BINGO_GRID_SIZE - 1 - index)),
  ];
}

/** Every line that scores a bingo (spec 12). */
export const BINGO_LINES: readonly number[][] = buildLines();

/**
 * Whether the done positions complete at least one line. The Joker always counts as done.
 *
 * @param donePositions - The positions of the cells that are done.
 * @returns True if a bingo line is complete.
 */
export function hasBingoLine(donePositions: ReadonlySet<number>): boolean {
  return BINGO_LINES.some((line) =>
    line.every((position) => position === JOKER_POSITION || donePositions.has(position))
  );
}
