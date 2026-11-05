"use client";

import { usePageTitle } from '@/hooks/AppContext';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('Dashboard');
  usePageTitle(t('title'));

  return <>{children}</>;
}
