/**
 * Cell Snapshot - The copy of a resolution's definition that a bingo cell holds
 * Spec Reference: 05-bingo-card-generation.md - Data Model Notes, 09-bingo-card-editing.md
 *
 * A cell is filled once from a resolution or a prepared pool entry. Later edits to that source
 * never reach the cell, and the cell's progress starts from zero.
 */

import type { Subtask } from '../shared/types';
import { ResolutionType } from '../shared/types';
import { execute, type Executor } from './connection';

/** The definition fields a cell copies from its source. */
export interface CellSnapshot {
  title: string | null;
  description: string | null;
  resolutionType: ResolutionType;
  numberOfRepetition: number | null;
  subtasks: Subtask[];
}

/** A definition a cell can be filled from: a resolution or a prepared pool entry. */
export interface SnapshotSource {
  title: string;
  description: string | null;
  resolutionType: ResolutionType;
  numberOfRepetition: number | null;
  subtasks: Subtask[] | null;
}

/** The snapshot of an empty cell: no content. */
export const EMPTY_SNAPSHOT: CellSnapshot = {
  title: null,
  description: null,
  resolutionType: ResolutionType.BASE,
  numberOfRepetition: null,
  subtasks: [],
};

/**
 * Copy a definition into the shape a cell stores. Only the fields of its type are kept.
 * @param source The resolution or pool entry
 * @returns The cell's snapshot
 */
export function snapshotOf(source: SnapshotSource): CellSnapshot {
  const isCompound = source.resolutionType === ResolutionType.COMPOUND;
  const isIterative = source.resolutionType === ResolutionType.ITERATIVE;

  return {
    title: source.title,
    description: source.description,
    resolutionType: source.resolutionType,
    numberOfRepetition: isIterative ? source.numberOfRepetition : null,
    subtasks: isCompound
      ? (source.subtasks ?? []).map(({ title, description }) => ({ title, description: description ?? '' }))
      : [],
  };
}

/**
 * Insert the subtasks of a cell's snapshot, all uncompleted.
 * @param executor Where to run the inserts; pass the transaction's connection
 * @param cellId The cell
 * @param subtasks The snapshot's subtasks, in order
 */
export async function insertCellSubtasks(
  executor: Executor,
  cellId: string,
  subtasks: Subtask[]
): Promise<void> {
  for (const [index, subtask] of subtasks.entries()) {
    await execute(
      `INSERT INTO bingo_cell_subtasks (cell_id, subtask_index, title, description, completed)
       VALUES (?, ?, ?, ?, 0)`,
      [cellId, index, subtask.title, subtask.description || null],
      executor
    );
  }
}

/**
 * Replace a cell's snapshot and reset its progress: the counter goes back to 0 and the
 * subtasks are replaced by the new, uncompleted ones. State and source are left to the caller.
 * @param executor Where to run the writes; pass the transaction's connection
 * @param cellId The cell
 * @param snapshot The new snapshot
 */
export async function replaceCellSnapshot(
  executor: Executor,
  cellId: string,
  snapshot: CellSnapshot
): Promise<void> {
  await execute(
    `UPDATE bingo_cells
     SET title = ?, description = ?, resolution_type = ?, number_of_repetition = ?, completed_times = 0
     WHERE id = ?`,
    [snapshot.title, snapshot.description, snapshot.resolutionType, snapshot.numberOfRepetition, cellId],
    executor
  );
  await execute(`DELETE FROM bingo_cell_subtasks WHERE cell_id = ?`, [cellId], executor);
  await insertCellSubtasks(executor, cellId, snapshot.subtasks);
}
