/**
 * Helpers shared by the resolutions DB tests: setups and direct table reads.
 * Spec Reference: 00-system-overview.md - Core Concepts / Data
 */

import { ResolutionType } from '@/lib/shared/types';
import { query } from '../../support/db/test-connection';

/** The persisted fields of a resolution that the tests look at. */
export interface StoredResolution {
  title: string;
  description: string | null;
  resolution_type: ResolutionType;
  subtasks: string | null;
  number_of_repetition: number | null;
}

/**
 * Read a resolution straight from the table, bypassing the repository.
 * @param id The resolution
 * @returns The stored fields
 */
export const readResolution = async (id: string): Promise<StoredResolution> => {
  const rows = await query<StoredResolution[]>(
    'SELECT title, description, resolution_type, subtasks, number_of_repetition FROM resolutions WHERE id = ?',
    [id]
  );
  return rows[0];
};
