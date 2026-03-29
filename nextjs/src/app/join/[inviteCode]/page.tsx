"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AppLogo } from '@/components/icons';
import { Loader2, Users, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { AuthContext } from '@/app/api/utils';

/**
 * Join Team Page
 * Spec Reference: 04-bingo-teams.md - Invitations / Joining
 */
export default function JoinTeamPage({ params }: AuthContext<{ inviteCode: string }>) {
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

    try {
      const response = await fetch(`/api/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Successfully joined the team!');
        setTimeout(() => {
          router.push(`/teams/${data.team.id}`);
        }, 2000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to join team');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred. Please try again.');
    }
  };

  useEffect(() => {
    if (inviteCode) {
      setStatus('loading');
    }
  }, [inviteCode]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background">
      <div className="mb-8 flex items-center gap-2">
        <AppLogo />
        <span className="text-2xl font-semibold font-headline">Resolution Bingo</span>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <Users className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="font-headline text-2xl">Join a Team</CardTitle>
          <CardDescription>
            You've been invited to join a Resolution Bingo team!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Ready to join? Click the button below to accept the invitation.
              </p>
              <Button onClick={handleJoin} className="w-full" size="lg">
                Accept Invitation
              </Button>
              <p className="text-xs text-muted-foreground">
                You'll need to be logged in to join the team.
              </p>
            </div>
          )}

          {status === 'joining' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">Joining team...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
              <p className="mt-4 text-green-600 font-medium">{message}</p>
              <p className="text-sm text-muted-foreground mt-2">Redirecting to team page...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-8 space-y-4">
              <XCircle className="h-12 w-12 mx-auto text-red-500" />
              <p className="text-red-600 font-medium">{message}</p>
              <div className="space-y-2">
                <Button onClick={handleJoin} variant="outline" className="w-full">
                  Try Again
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link href="/login">Login to Continue</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
