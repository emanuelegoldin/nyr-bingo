"use client";

import { createContext, useContext, useMemo, useState } from "react";

type AppHeaderTitleContextValue = {
  title: string;
  setTitle: (title: string) => void;
};

const AppHeaderTitleContext = createContext<AppHeaderTitleContextValue | null>(
  null
);

export function AppHeaderTitleProvider({
  defaultTitle = "Dashboard",
  children,
}: {
  defaultTitle?: string;
  children: React.ReactNode;
}) {
  const [title, setTitle] = useState(defaultTitle);

  const value = useMemo(() => ({ title, setTitle }), [title]);

  return (
    <AppHeaderTitleContext.Provider value={value}>
      {children}
    </AppHeaderTitleContext.Provider>
  );
}

export function useAppHeaderTitle() {
  const context = useContext(AppHeaderTitleContext);

  if (!context) {
    throw new Error(
      "useAppHeaderTitle must be used within AppHeaderTitleProvider"
    );
  }
  return context;
}