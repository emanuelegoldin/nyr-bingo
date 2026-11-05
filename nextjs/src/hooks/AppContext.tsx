"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState } from "react";

type AppContextValue = {
  title: string;
  setTitle: (title: string) => void;
};

const AppContext = createContext<AppContextValue | null>(
  null
);

export function AppContextProvider({
  defaultTitle = "Dashboard",
  children,
}: {
  defaultTitle?: string;
  children: React.ReactNode;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const value = useMemo(
    () => ({ title, setTitle }),
    [title]
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
