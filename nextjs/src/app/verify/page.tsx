"use client";

/**
 * Email Verification Page
 * Spec Reference: 01-authentication.md - Email Verification
 * 
 * Users land here after clicking the verification link in their email
 */

import { CornerLocaleSwitcher } from '@/components/locale-switcher';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('Verify');
  const tc = useTranslations('Common');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(t('verifying'));

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage(t('noToken'));
      return;
    }

    const verifyEmail = async () => {
      const result = await apiFetch<{ message?: string }>('/api/auth/verify', {
        method: 'POST',
        json: { token },
      });

      if (result.ok) {
        setStatus('success');
        setMessage(result.data.message || t('successDefault'));
      } else {
        setStatus('error');
        setMessage(apiErrorMessage(
          result,
          t('failedFallback'),
          tc('networkError')
        ));
      }
    };

    verifyEmail();
    // Translators are intentionally left out: a locale change must not re-submit the one-time token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <CornerLocaleSwitcher />
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-headline text-2xl">{t('title')}</CardTitle>
          <CardDescription>
            {status === 'loading' && t('descLoading')}
            {status === 'success' && t('descSuccess')}
            {status === 'error' && t('descError')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'loading' && (
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="h-16 w-16 text-green-600" />
              <p className="text-center text-muted-foreground">{message}</p>
              <Button
                onClick={() => router.push('/login')}
                className="w-full"
              >
                {t('goToLogin')}
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-destructive" />
              <p className="text-center text-muted-foreground">{message}</p>
              <div className="flex gap-2 w-full">
                <Button
                  onClick={() => router.push('/login')}
                  variant="outline"
                  className="flex-1"
                >
                  {t('login')}
                </Button>
                <Button
                  onClick={() => router.push('/profile')}
                  className="flex-1"
                >
                  {t('goToProfile')}
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {t('expiredHint')}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-8 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
