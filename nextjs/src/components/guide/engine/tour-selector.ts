/**
 * Selector of the elements a tour highlights, marked with a `data-tour` attribute.
 * Spec Reference: 26-guided-tour.md - Module Boundary
 */

/**
 * Builds the selector of an element marked with a `data-tour` attribute.
 *
 * @param target - The `data-tour` value.
 * @returns The CSS selector.
 */
export const tourSelector = (target: string): string => `[data-tour="${target}"]`;
