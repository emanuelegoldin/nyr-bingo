/**
 * Dashboard Page
 * Spec Reference: 00-system-overview.md - Primary Flows
 *
 * Server-first implementation:
 * - Authentication and initial team/card reads are done on the server
 * - Each started-team card streams independently via Suspense
 */

import DashboardPageShell from '@/components/dashboard/dashboard-page-shell';
import DashboardTeamCardClient from '@/components/dashboard/dashboard-team-card-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDictionary } from '@/i18n/request';
import { getCurrentUser } from '@/lib/auth';
import {
  getBingoCard,
  getTeamWithMembers,
  getTeamsForUser,
  type TeamWithMembers,
} from '@/lib/db';
import { Link, Loader2, Plus, Users } from 'lucide-react';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

// TODO: we could create the loading fallback through composition with a dummy empty cell
async function DashboardCardLoadingFallback({ teamName }: { teamName: string }) {
  const t = (await getDictionary()).Dashboard;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">
          {t.cardTitle.replace('{teamName}', teamName)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading card...</span>
        </div>
      </CardContent>
    </Card>
  );
}

async function DashboardCardError({ teamName }: { teamName: string }) {
  const t = (await getDictionary()).Dashboard;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">
          {t.cardTitle.replace('{teamName}', teamName)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-destructive">
          Failed to load this card. Other cards are still available.
        </p>
      </CardContent>
    </Card>
  );
}

async function DashboardCardMissing({ teamName }: { teamName: string }) {
  const t = (await getDictionary()).Dashboard;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">
          {t.cardTitle.replace('{teamName}', teamName)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {t.cardContentNoneAvailable}
        </p>
      </CardContent>
    </Card>
  );
}

async function DashboardTeamCardStream({
  team,
  currentUserId,
}: {
  team: TeamWithMembers;
  currentUserId: string;
}) {
  const t = (await getDictionary()).Dashboard;  // Get dictionary here (ServerComponent) and pass strings to CLientComponents
  try {
    // Each team card loads independently so one slow query does not block others.
    const card = await getBingoCard(team.id, currentUserId);
    if (!card) {
      return <DashboardCardMissing teamName={team.name} />;
    }

    return (
      <DashboardTeamCardClient
        team={team}
        currentUserId={currentUserId}
        initialCard={card}
        // Pass translation strings to avoid issues with importing server funcitons into clients components!
        dashboardText={{
          cardTitle: t.cardTitle,
          headerDescription: t.headerDescription,
        }}
      />
    );
  } catch {
    // Isolated error handling keeps the rest of the dashboard usable.
    return <DashboardCardError teamName={team.name} />;
  }
}

async function getTeamsWithMembersForUser(userId: string): Promise<TeamWithMembers[]> {
  const teams = await getTeamsForUser(userId);
  const settledTeams = await Promise.allSettled(
    teams.map((team) => getTeamWithMembers(team.id))
  );

  return settledTeams
    .filter(
      (result): result is PromiseFulfilledResult<TeamWithMembers | null> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value)
    .filter((team): team is TeamWithMembers => team !== null);
}

async function DashboardNoTeam() {
  const t = (await getDictionary()).Dashboard;

  return (
    <div className="container mx-auto">
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-16 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold font-headline mb-2">{t.headerContent}</h2>
          <p className="text-muted-foreground mb-6">
            {t.headerDescriptionNoTeam}
          </p>
          <Button asChild>
            <Link href="/teams">
              <Plus className="mr-2 h-4 w-4" /> Get Started
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

async function DashboardNoStartedGames() {
  const t = (await getDictionary()).Dashboard;

  return (
    <div className="container mx-auto">
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-16 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold font-headline mb-2">{t.headerContent}</h2>
          <p className="text-muted-foreground mb-6">
            {t.headerDescriptionNoTeam}
          </p>
          <Button asChild>
            <Link href="/teams">
              <Plus className="mr-2 h-4 w-4" /> Get Started
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

DashboardPage.Content = ({ teams, currentUserId }: { teams: TeamWithMembers[]; currentUserId: string }) => {
  if (teams.length === 0) {
    return <DashboardNoTeam />;
  }

  const startedTeams = teams.filter((team) => team.status === 'started');
  if (startedTeams.length === 0) {
    return <DashboardNoStartedGames />;
  }

  return (
    <div className="container mx-auto space-y-8">
      {startedTeams.map((team) => (
        <Suspense
          key={team.id}
          fallback={<DashboardCardLoadingFallback teamName={team.name} />}
        >
          <DashboardTeamCardStream team={team} currentUserId={currentUserId} />
        </Suspense>
      ))}
    </div>
  )
}

export default async function DashboardPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    redirect('./login');
  }

  const teams = await getTeamsWithMembersForUser(currentUser.id);

  return (
    <DashboardPageShell>
      <DashboardPage.Content teams={teams} currentUserId={currentUser.id} />
    </DashboardPageShell>
  );
}

