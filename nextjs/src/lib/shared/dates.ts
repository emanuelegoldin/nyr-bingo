/**
 * Date helpers usable from server and client code.
 */

/**
 * Converts a date to the ISO string it becomes once serialized to JSON.
 *
 * @param value - Date, or an already serialized date string.
 * @returns The ISO date string.
 */
export const toIsoDateString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : value;
