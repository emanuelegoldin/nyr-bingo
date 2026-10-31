import type { ResolutionTypeValue } from './types';

/** Badge variants supported by the Badge UI component for resolution types. */
export type ResolutionTypeBadgeVariant = 'default' | 'secondary' | 'outline';

/** Human-readable labels for resolution types. */
export const RESOLUTION_TYPE_LABELS: Record<ResolutionTypeValue, string> = {
  base: 'Common',
  compound: 'Complex',
  iterative: 'Iterative',
};

/** Badge variant per resolution type for visual distinction. */
export const RESOLUTION_TYPE_BADGE_VARIANTS: Record<ResolutionTypeValue, ResolutionTypeBadgeVariant> = {
  base: 'secondary',
  compound: 'default',
  iterative: 'outline',
};
