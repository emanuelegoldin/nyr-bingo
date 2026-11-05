'use client';

import { useToast } from '@/hooks/use-toast';
import { apiErrorMessage, type ApiFailure } from '@/lib/api-client';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** Shows the standard error toast for a failed API call. */
export type ApiErrorToast = (result: Pick<ApiFailure, 'status' | 'error'>, fallback: string) => void;

/**
 * Hook returning the standard destructive toast for a failed API call, with its title and
 * network-failure text in the active locale (spec 15). The server's own error message is shown
 * as it arrives; `fallback` is used when the response carries none.
 *
 * @returns A function that takes the failure and the translated fallback text.
 */
export const useApiErrorToast = (): ApiErrorToast => {
  const { toast } = useToast();
  const t = useTranslations('Common');

  return useCallback((result, fallback) => {
    toast({
      title: t('error'),
      description: apiErrorMessage(result, fallback, t('networkError')),
      variant: 'destructive',
    });
  }, [toast, t]);
};
