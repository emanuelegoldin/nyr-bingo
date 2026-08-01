"use client";

import { useAppContext } from '@/hooks/AppContext';
import type { ReactNode } from 'react';

interface DashboardPageShellProps {
  children: ReactNode;
}

/**
 * Client shell for dashboard-level client context concerns.
 *
 * The heavy data fetching remains in the server page and is passed as children
 * so hydration stays minimal.
 */
export default function DashboardPageShell({ children }: DashboardPageShellProps) {
  const { setTitle } = useAppContext();
  setTitle('Dashboard');

  return <>{children}</>;
}
