"use client";

import type { ReactNode } from 'react';
import { useSetAppHeaderTitle } from '@/components/app-header-title';

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
  useSetAppHeaderTitle('Dashboard');

  return <>{children}</>;
}
