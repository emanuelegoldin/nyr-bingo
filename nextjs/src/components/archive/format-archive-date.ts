/**
 * Format the end date of an archived game.
 *
 * @param iso - The date as an ISO string.
 * @param locale - The active locale (from `useLocale()`).
 * @returns The date in the given locale.
 */
export const formatArchiveDate = (iso: string, locale: string): string =>
  new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
