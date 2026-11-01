import type { ResolutionTypeValue } from './types';

/** Badge variants supported by the Badge UI component for resolution types. */
export type ResolutionTypeBadgeVariant = 'default' | 'secondary' | 'outline';

/** Human-readable labels for resolution types. */
export const RESOLUTION_TYPE_LABELS: Record<ResolutionTypeValue, string> = {
  base: 'Common',
  compound: 'Complex',
  iterative: 'Iterative',
};

/**
 * The text resolutions are compared by: the description or, without one, the title,
 * ignoring case.
 * @param title The resolution's title
 * @param description The resolution's description, if any
 * @returns The value to compare
 */
export function getResolutionTextKey(title: string, description?: string | null): string {
  return (description || title).toLowerCase();
}

/** Badge variant per resolution type for visual distinction. */
export const RESOLUTION_TYPE_BADGE_VARIANTS: Record<ResolutionTypeValue, ResolutionTypeBadgeVariant> = {
  base: 'secondary',
  compound: 'default',
  iterative: 'outline',
};
