/**
 * Server helper that reads the stored theme.
 * Spec Reference: 25-theming.md - Selection and Persistence
 */

import { cookies } from 'next/headers';
import { defaultTheme, isAppTheme, THEME_COOKIE_NAME, type AppTheme } from './config';

/**
 * Read the theme stored in the `theme` cookie.
 *
 * @returns The stored theme, or the default theme when the cookie is missing or invalid.
 */
export const getTheme = async (): Promise<AppTheme> => {
  const cookieStore = await cookies();
  const value = cookieStore.get(THEME_COOKIE_NAME)?.value;
  return isAppTheme(value) ? value : defaultTheme;
};
