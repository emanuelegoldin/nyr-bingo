/**
 * Mappers that build ResolutionFormData and the initial form state for the resolution create/edit dialog.
 * Pure functions with no server-only imports, usable from server and client code.
 * Spec Reference: 03-personal-resolutions.md - Create Dialog
 */

import { toIsoDateString } from "./dates";
import type { ResolutionFormData, ResolutionType, ResolutionTypeValue, Subtask, UnifiedResolution } from "./types";

/** The editable fields of the resolution dialog. */
export interface ResolutionFormState {
  type: ResolutionTypeValue;
  title: string;
  text: string;
  subtasks: Subtask[];
  numberOfRepetition: number;
}

/** The repetition target an iterative resolution starts with (spec 03 requires at least 2). */
const DEFAULT_NUMBER_OF_REPETITION = 2;

/**
 * Builds the state the resolution dialog opens with: the resolution being edited, or an empty Common form.
 *
 * @param initialData - The resolution being edited; undefined to create one.
 * @returns The form state.
 */
export const initialResolutionFormState = (initialData: ResolutionFormData | undefined): ResolutionFormState => ({
  type: initialData?.type ?? "base",
  title: initialData?.title ?? "",
  text: initialData?.text ?? "",
  subtasks: initialData?.subtasks ?? [],
  numberOfRepetition: initialData?.numberOfRepetition ?? DEFAULT_NUMBER_OF_REPETITION,
});

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
  createdAt: Date | string;
  updatedAt: Date | string;
}

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
  createdAt: toIsoDateString(resolution.createdAt),
  updatedAt: toIsoDateString(resolution.updatedAt),
});
