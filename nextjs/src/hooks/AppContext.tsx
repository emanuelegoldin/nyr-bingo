"use client";

import { LOCALE_COOKIE_NAME, type Locale } from "@/i18n/locale";
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";

type AppContextValue = {
  title: string;
  setTitle: (title: string) => void;
  language: Locale;
  setLanguage: (language: Locale) => void;
};

const AppContext = createContext<AppContextValue | null>(
  null
);

export function AppContextProvider({
  defaultTitle = "Dashboard",
  defaultLanguage = "en",
  children,
}: {
  defaultTitle?: string;
  defaultLanguage?: Locale;
  children: React.ReactNode;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [language, setLanguageState] = useState<Locale>(defaultLanguage);

  const setLanguage = useCallback((nextLanguage: Locale) => {
    setLanguageState(nextLanguage);
    document.cookie = `${LOCALE_COOKIE_NAME}=${nextLanguage}; path=/; max-age=31536000`;
  }, []);

  const value = useMemo(
    () => ({ title, setTitle, language, setLanguage }),
    [title, language, setLanguage]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error(
      "useAppContext must be used within AppHeaderTitleProvider"
    );
  }
  return context;
}

/**
 * Set the title shown in the app header for the current page.
 * Runs before paint so the previous page's title never flashes during navigation.
 * @param title The header title
 */
export function usePageTitle(title: string): void {
  const { setTitle } = useAppContext();

  useLayoutEffect(() => {
    setTitle(title);
  }, [setTitle, title]);
}

// Make it optional since the language selector in the home page is outside of the AppContextProvider. TODO: refactor the home page to be inside the AppContextProvider.
export function useOptionalAppContext() {
  return useContext(AppContext);
}