/**
 * Locale settings shared by the server and the browser (spec 15).
 */

/** Supported locales. */
export const locales = ['en', 'de', 'it'] as const;

/** A supported locale. */
export type AppLocale = (typeof locales)[number];

/** Locale used when no valid locale is stored. */
export const defaultLocale: AppLocale = 'en';

/** Cookie that stores the chosen locale. */
export const LOCALE_COOKIE_NAME = 'locale';

/** How long the locale cookie lasts, in seconds (one year). */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Each locale's name in its own language, as shown by the language switcher. */
export const localeNames: Record<AppLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  it: 'Italiano',
};

/**
 * Check whether a value is a supported locale.
 *
 * @param value - The value to check, e.g. a cookie value.
 * @returns True when the value is a supported locale.
 */
export const isAppLocale = (value: unknown): value is AppLocale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value);
