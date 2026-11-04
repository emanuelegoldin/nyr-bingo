/**
 * Archived Game Page
 * Spec Reference: 18-game-archive.md - Archived Game Page
 */

import { requireUser } from '@/lib/auth';
import { authorize, requirePagePermission } from '@/lib/authz';
import { getArchivedGame } from '@/lib/db';
import { notFound } from 'next/navigation';
import ArchivedGamePageClient from './archived-game-page-client';

interface ArchivedGamePageProps {
  params: Promise<{ archivedGameId: string }>;
}

export default async function ArchivedGamePage({ params }: ArchivedGamePageProps) {
  const currentUser = await requireUser();
  const { archivedGameId } = await params;

  const archivedGame = await getArchivedGame(archivedGameId);
  if (!archivedGame) {
    notFound();
  }
  const target = { scope: 'archive', archivedGameId } as const;
  await requirePagePermission(currentUser, 'archive.view', target);

  return (
    <ArchivedGamePageClient
      archivedGame={archivedGame}
      canDelete={(await authorize(currentUser, 'archive.delete', target)).allowed}
    />
  );
}
