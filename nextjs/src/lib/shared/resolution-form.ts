/**
 * Mappers that build ResolutionFormData for the resolution create/edit dialog.
 * Pure functions with no server-only imports, usable from server and client code.
 */

import type { ResolutionFormData, ResolutionType, ResolutionTypeValue, Subtask, UnifiedResolution } from "./types";

/** Subset of a stored resolution (db `Resolution`) that the form needs. */
export interface ResolutionFormSource {
  id: string;
  resolutionType: ResolutionType;
  title: string;
  description: string | null;
  subtasks: Subtask[] | null;
  numberOfRepetition: number | null;
}

/** Subset of the unified API resolution shape that the form needs. */
export type UnifiedFormSource = Pick<
  ResolutionFormData,
  "id" | "type" | "title" | "subtasks" | "numberOfRepetition"
> & { text?: string | null };

/**
 * Builds form data from a stored resolution; null subtasks/repetitions become undefined.
 *
 * @param resolution - Stored resolution (or a structural subset of it).
 * @returns Form data for the resolution dialog.
 */
export const resolutionToFormData = (resolution: ResolutionFormSource): ResolutionFormData => ({
  id: resolution.id,
  type: resolution.resolutionType as ResolutionFormData["type"],
  title: resolution.title,
  text: resolution.description ?? "",
  subtasks: resolution.subtasks ?? undefined,
  numberOfRepetition: resolution.numberOfRepetition ?? undefined,
});

/**
 * Builds form data from the unified API resolution shape; subtasks and repetitions are passed through as-is.
 *
 * @param resolution - Resolution in the unified API shape.
 * @returns Form data for the resolution dialog.
 */
export const unifiedToFormData = (resolution: UnifiedFormSource): ResolutionFormData => ({
  id: resolution.id,
  type: resolution.type,
  title: resolution.title,
  text: resolution.text ?? "",
  subtasks: resolution.subtasks,
  numberOfRepetition: resolution.numberOfRepetition,
});

/** Subset of a stored resolution (db `Resolution`) needed for the unified API shape. */
export interface UnifiedResolutionSource extends ResolutionFormSource {
  ownerUserId: string;
  completedTimes: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/**
 * Converts a date to the ISO string it becomes once serialized to JSON.
 *
 * @param value - Date, or an already serialized date string.
 * @returns The ISO date string.
 */
const toIsoDateString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;

/**
 * Builds the unified API shape from a stored resolution; null subtasks/repetitions become undefined.
 *
 * @param resolution - Stored resolution (or a structural subset of it).
 * @returns The resolution in the unified shape, with ISO date strings.
 */
export const toUnifiedResolution = (resolution: UnifiedResolutionSource): UnifiedResolution => ({
  id: resolution.id,
  type: resolution.resolutionType as ResolutionTypeValue,
  ownerUserId: resolution.ownerUserId,
  title: resolution.title,
  text: resolution.description ?? "",
  subtasks: resolution.subtasks ?? undefined,
  numberOfRepetition: resolution.numberOfRepetition ?? undefined,
  completedTimes: resolution.completedTimes,
  createdAt: toIsoDateString(resolution.createdAt),
  updatedAt: toIsoDateString(resolution.updatedAt),
});
