/**
 * Theme settings shared by the server and the browser.
 * Spec Reference: 25-theming.md - Themes
 */

/** Supported themes. */
export const themes = ['light', 'dark', 'system'] as const;

/** A supported theme. */
export type AppTheme = (typeof themes)[number];

/** A theme as actually shown on screen, once `system` is resolved. */
export type ResolvedTheme = Exclude<AppTheme, 'system'>;

/** Theme used when no valid theme is stored. */
export const defaultTheme: AppTheme = 'system';

/** Cookie that stores the chosen theme. */
export const THEME_COOKIE_NAME = 'theme';

/** How long the theme cookie lasts, in seconds (one year). */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** Media query matching an operating system that prefers the dark theme. */
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Check whether a value is a supported theme.
 *
 * @param value - The value to check, e.g. a cookie value.
 * @returns True when the value is a supported theme.
 */
export const isAppTheme = (value: unknown): value is AppTheme =>
  typeof value === 'string' && (themes as readonly string[]).includes(value);
