"use client";

/**
 * Client context holding the active theme and applying it to the page.
 * Spec Reference: 25-theming.md - Selection and Persistence
 */

import {
  DARK_MEDIA_QUERY,
  THEME_COOKIE_MAX_AGE,
  THEME_COOKIE_NAME,
  type AppTheme,
  type ResolvedTheme,
} from "@/lib/theme/config";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

interface ThemeContextValue {
  /** The stored theme, possibly `system`. */
  theme: AppTheme;
  /** Store a new theme and apply it immediately. */
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolve a theme to the one shown on screen.
 *
 * @param theme - The stored theme.
 * @returns `dark` or `light`; `system` follows the operating system's preference.
 */
const resolveTheme = (theme: AppTheme): ResolvedTheme => {
  if (theme !== "system") return theme;
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
};

/**
 * Apply a resolved theme to the `<html>` element.
 *
 * @param resolved - The theme to show.
 */
const applyTheme = (resolved: ResolvedTheme): void => {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
};

interface ThemeProviderProps {
  /** The theme the server read from the cookie. */
  initialTheme: AppTheme;
  children: ReactNode;
}

/**
 * Provide the active theme to the switcher, and keep the page in sync with it.
 * While the theme is `system`, the page follows changes of the operating system's preference.
 *
 * @param props.initialTheme - The theme the server read from the cookie.
 * @param props.children - The page content.
 * @returns The provider.
 */
export function ThemeProvider({ initialTheme, children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<AppTheme>(initialTheme);

  useEffect(() => {
    applyTheme(resolveTheme(theme));
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia(DARK_MEDIA_QUERY);
    const handleChange = () => applyTheme(resolveTheme("system"));
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    document.cookie = `${THEME_COOKIE_NAME}=${nextTheme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
    setThemeState(nextTheme);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Read the active theme and the function that changes it.
 *
 * @returns The theme context.
 * @throws When used outside a `ThemeProvider`.
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider");
  return context;
};
