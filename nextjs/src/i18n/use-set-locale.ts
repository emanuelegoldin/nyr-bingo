'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { LOCALE_COOKIE_MAX_AGE, LOCALE_COOKIE_NAME, type AppLocale } from './config';

/**
 * Hook that changes the interface language (spec 15).
 *
 * @returns A function that stores the locale in the `locale` cookie and refreshes the
 * page, so server components render again in the new language.
 */
export const useSetLocale = (): ((locale: AppLocale) => void) => {
  const router = useRouter();

  return useCallback((locale: AppLocale) => {
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
    router.refresh();
  }, [router]);
};
