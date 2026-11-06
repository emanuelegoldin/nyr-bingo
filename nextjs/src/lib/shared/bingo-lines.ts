import { getJokerPosition } from './types';

/**
 * Build the positions of every row, column and diagonal of an N x N grid.
 *
 * @param gridSize - The side length of the card.
 * @returns One array of positions per line.
 */
function buildLines(gridSize: number): number[][] {
  const positions = Array.from({ length: gridSize }, (_, index) => index);
  return [
    ...positions.map((row) => positions.map((col) => row * gridSize + col)),
    ...positions.map((col) => positions.map((row) => row * gridSize + col)),
    positions.map((index) => index * gridSize + index),
    positions.map((index) => index * gridSize + (gridSize - 1 - index)),
  ];
}

/** The lines of each grid size, built on first use. */
const linesBySize = new Map<number, readonly number[][]>();

/**
 * Every line that scores a bingo on a card of the given size (spec 12).
 *
 * @param gridSize - The side length of the card.
 * @returns One array of positions per row, column and diagonal.
 */
export function getBingoLines(gridSize: number): readonly number[][] {
  let lines = linesBySize.get(gridSize);
  if (!lines) {
    lines = buildLines(gridSize);
    linesBySize.set(gridSize, lines);
  }
  return lines;
}

/**
 * Whether the done positions complete at least one line. The Joker always counts as done.
 *
 * @param gridSize - The side length of the card.
 * @param donePositions - The positions of the cells that are done.
 * @returns True if a bingo line is complete.
 */
export function hasBingoLine(gridSize: number, donePositions: ReadonlySet<number>): boolean {
  const jokerPosition = getJokerPosition(gridSize);
  return getBingoLines(gridSize).some((line) =>
    line.every((position) => position === jokerPosition || donePositions.has(position))
  );
}
