/**
 * Format the end date of an archived game.
 *
 * @param iso - The date as an ISO string.
 * @returns The date in the viewer's locale.
 */
export const formatArchiveDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
