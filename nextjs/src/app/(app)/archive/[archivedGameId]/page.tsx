/**
 * Archived Game Page
 * Spec Reference: 18-game-archive.md - Archived Game Page
 */

import { requireUser } from '@/lib/auth';
import { getArchivedGame, isArchivedGamePlayer } from '@/lib/db';
import { notFound } from 'next/navigation';
import ArchivedGamePageClient from './archived-game-page-client';

interface ArchivedGamePageProps {
  params: Promise<{ archivedGameId: string }>;
}

export default async function ArchivedGamePage({ params }: ArchivedGamePageProps) {
  const currentUser = await requireUser();
  const { archivedGameId } = await params;

  const archivedGame = await getArchivedGame(archivedGameId);
  if (!archivedGame || !(await isArchivedGamePlayer(archivedGameId, currentUser.id))) {
    notFound();
  }

  return (
    <ArchivedGamePageClient
      archivedGame={archivedGame}
      canDelete={archivedGame.leaderUserId === currentUser.id}
    />
  );
}
