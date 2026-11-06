/**
 * Dashboard Page
 * Spec Reference: 00-system-overview.md - Primary Flows
 *
 * Server-first implementation:
 * - Authentication and initial game/card reads are done on the server
 * - Each started-game card streams independently via Suspense
 */

import DashboardPageShell from '@/components/dashboard/dashboard-page-shell';
import DashboardGameCardClient from '@/components/dashboard/dashboard-game-card-client';
import { GameTag } from '@/components/dashboard/game-tag';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { requireUser } from '@/lib/auth';
import {
  getBingoCard,
  getGameWithMembers,
  getRunningGamesForUser,
  getTeamsForUser,
  type GameWithMembers,
} from '@/lib/db';
import { Loader2, Plus, Users } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';

/** The game fields a dashboard card placeholder shows. */
type DashboardGameRef = Pick<GameWithMembers, 'id' | 'name'>;

/**
 * Shared frame for the dashboard card placeholders (loading, error, missing).
 * Renders the card with the localized title, the tag linking to the game and the given body.
 *
 * @param game - The game the card belongs to, shown as a tag.
 * @param children - Body content rendered inside the card.
 * @returns The placeholder card.
 */
async function DashboardCardFrame({
  game,
  children,
}: {
  game: DashboardGameRef;
  children: ReactNode;
}) {
  const t = await getTranslations('Dashboard');

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">
          {t('cardTitle')}
        </CardTitle>
        <div className="mt-2">
          <GameTag gameId={game.id} gameName={game.name} label={t('openGame', { gameName: game.name })} />
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// TODO: we could create the loading fallback through composition with a dummy empty cell
async function DashboardCardLoadingFallback({ game }: { game: DashboardGameRef }) {
  const t = await getTranslations('Dashboard');

  return (
    <DashboardCardFrame game={game}>
      <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{t('loadingCard')}</span>
      </div>
    </DashboardCardFrame>
  );
}

async function DashboardCardError({ game }: { game: DashboardGameRef }) {
  const t = await getTranslations('Dashboard');

  return (
    <DashboardCardFrame game={game}>
      <p className="text-sm text-destructive">
        {t('cardLoadFailed')}
      </p>
    </DashboardCardFrame>
  );
}

async function DashboardCardMissing({ game }: { game: DashboardGameRef }) {
  const t = await getTranslations('Dashboard');

  return (
    <DashboardCardFrame game={game}>
      <p className="text-sm text-muted-foreground">
        {t('cardContentNoneAvailable')}
      </p>
    </DashboardCardFrame>
  );
}

async function DashboardGameCardStream({
  game,
  currentUserId,
}: {
  game: GameWithMembers;
  currentUserId: string;
}) {
  try {
    // Each game card loads independently so one slow query does not block others.
    const card = await getBingoCard(game.id, currentUserId);
    if (!card) {
      return <DashboardCardMissing game={game} />;
    }

    return (
      <DashboardGameCardClient
        game={game}
        currentUserId={currentUserId}
        initialCard={card}
      />
    );
  } catch {
    // Isolated error handling keeps the rest of the dashboard usable.
    return <DashboardCardError game={game} />;
  }
}

async function getStartedGamesForUser(userId: string): Promise<GameWithMembers[]> {
  const games = await getRunningGamesForUser(userId);
  const settledGames = await Promise.allSettled(
    games
      .filter((game) => game.status === 'started')
      .map((game) => getGameWithMembers(game.id))
  );

  return settledGames
    .filter(
      (result): result is PromiseFulfilledResult<GameWithMembers | null> =>
        result.status === 'fulfilled'
    )
    .map((result) => result.value)
    .filter((game): game is GameWithMembers => game !== null);
}

/**
 * Empty-state card shown when the user has no team or no started games.
 *
 * @param hasTeams - Whether the user is in a team.
 * @returns The empty-state card.
 */
async function DashboardEmptyState({ hasTeams }: { hasTeams: boolean }) {
  const t = await getTranslations('Dashboard');

  return (
    <div className="container mx-auto">
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="py-16 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold font-headline mb-2">{t('headerContent')}</h2>
          <p className="text-muted-foreground mb-6">
            {hasTeams ? t('headerDescriptionNoGames') : t('headerDescriptionNoTeam')}
          </p>
          <Button asChild>
            <Link href="/teams">
              <Plus className="mr-2 h-4 w-4" /> {t('getStarted')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

DashboardPage.Content = ({
  games,
  hasTeams,
  currentUserId,
}: {
  games: GameWithMembers[];
  hasTeams: boolean;
  currentUserId: string;
}) => {
  if (games.length === 0) {
    return <DashboardEmptyState hasTeams={hasTeams} />;
  }

  return (
    <div className="container mx-auto space-y-8">
      {games.map((game) => (
        <Suspense
          key={game.id}
          fallback={<DashboardCardLoadingFallback game={game} />}
        >
          <DashboardGameCardStream game={game} currentUserId={currentUserId} />
        </Suspense>
      ))}
    </div>
  )
}

export default async function DashboardPage() {
  const currentUser = await requireUser();

  const [games, teams] = await Promise.all([
    getStartedGamesForUser(currentUser.id),
    getTeamsForUser(currentUser.id),
  ]);

  return (
    <DashboardPageShell>
      <DashboardPage.Content games={games} hasTeams={teams.length > 0} currentUserId={currentUser.id} />
    </DashboardPageShell>
  );
}

