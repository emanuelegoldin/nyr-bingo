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
import { requireUser } from '@/lib/auth';
import {
  getBingoCard,
  getTeamWithMembers,
  getTeamsForUser,
  type TeamWithMembers,
} from '@/lib/db';
import { Link, Loader2, Plus, Users } from 'lucide-react';
import { Suspense, type ReactNode } from 'react';

/**
 * Shared frame for the dashboard card placeholders (loading, error, missing).
 * Renders the card with the localized team title and the given body.
 *
 * @param teamName - Name of the team shown in the card title.
 * @param children - Body content rendered inside the card.
 * @returns The placeholder card.
 */
async function DashboardCardFrame({
  teamName,
  children,
}: {
  teamName: string;
  children: ReactNode;
}) {
  const t = (await getDictionary()).Dashboard;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">
          {t.cardTitle.replace('{teamName}', teamName)}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// TODO: we could create the loading fallback through composition with a dummy empty cell
function DashboardCardLoadingFallback({ teamName }: { teamName: string }) {
  return (
    <DashboardCardFrame teamName={teamName}>
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading card...</span>
      </div>
    </DashboardCardFrame>
  );
}

function DashboardCardError({ teamName }: { teamName: string }) {
  return (
    <DashboardCardFrame teamName={teamName}>
      <p className="text-sm text-destructive">
        Failed to load this card. Other cards are still available.
      </p>
    </DashboardCardFrame>
  );
}

async function DashboardCardMissing({ teamName }: { teamName: string }) {
  const t = (await getDictionary()).Dashboard;

  return (
    <DashboardCardFrame teamName={teamName}>
      <p className="text-sm text-muted-foreground">
        {t.cardContentNoneAvailable}
      </p>
    </DashboardCardFrame>
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

/**
 * Empty-state card shown when the user has no team or no started games.
 * Note: `Link` is imported from lucide-react (known gap, spec 14); kept as is.
 *
 * @returns The empty-state card.
 */
async function DashboardEmptyState() {
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
    return <DashboardEmptyState />;
  }

  const startedTeams = teams.filter((team) => team.status === 'started');
  if (startedTeams.length === 0) {
    return <DashboardEmptyState />;
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
  const currentUser = await requireUser();

  const teams = await getTeamsWithMembersForUser(currentUser.id);

  return (
    <DashboardPageShell>
      <DashboardPage.Content teams={teams} currentUserId={currentUser.id} />
    </DashboardPageShell>
  );
}

