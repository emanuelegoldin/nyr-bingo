"use client";

import { AuthContext } from '@/app/api/utils';
import { AppLogo } from '@/components/icons';
import { CornerLocaleSwitcher } from '@/components/locale-switcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { CheckCircle2, Loader2, Users, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Join Team Page
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */
export default function JoinTeamPage({ params }: AuthContext<{ inviteCode: string }>) {
  const t = useTranslations('Teams');
  const tc = useTranslations('Common');
  const router = useRouter();
  const [inviteCode, setInviteCode] = useState<string>('');
  const [status, setStatus] = useState<'loading' | 'joining' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    params.then(p => setInviteCode(p.inviteCode));
  }, [params]);

  const handleJoin = async () => {
    if (!inviteCode) return;

    setStatus('joining');

    const result = await apiFetch<{ team: { id: string } }>('/api/join', {
      method: 'POST',
      json: { inviteCode },
    });

    if (result.ok) {
      setStatus('success');
      setMessage(t('join.joined'));
      setTimeout(() => {
        router.push(`/teams/${result.data.team.id}`);
      }, 2000);
    } else {
      setStatus('error');
      setMessage(apiErrorMessage(result, t('join.joinFailed'), tc('networkError')));
    }
  };

  useEffect(() => {
    if (inviteCode) {
      setStatus('loading');
    }
  }, [inviteCode]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <CornerLocaleSwitcher />
      <div className="mb-8 flex items-center gap-2">
        <AppLogo />
        <span className="text-2xl font-semibold font-headline">Resolution Bingo</span>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl">{t('join.title')}</CardTitle>
          <CardDescription>
            {t('join.invited')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                {t('join.ready')}
              </p>
              <Button onClick={handleJoin} className="w-full" size="lg">
                {t('join.accept')}
              </Button>
              <p className="text-xs text-muted-foreground">
                {t('join.loginNeeded')}
              </p>
            </div>
          )}

          {status === 'joining' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">{t('join.joining')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-success" />
              <p className="mt-4 text-success font-medium">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">{t('join.redirecting')}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8 space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-destructive" />
              <p className="text-destructive font-medium">{message}</p>
              <div className="space-y-2">
                <Button onClick={handleJoin} variant="outline" className="w-full">
                  {t('join.tryAgain')}
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/login">{t('join.login')}</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
