/**
 * Access check shared by the game routes.
 * Spec Reference: 21-authorization.md - Status Rules
 */

import type { NextResponse } from 'next/server';
import { errorResponse } from '@/app/api/utils';
import { authorize } from '@/lib/authz';
import type { GamePermission, ScopeRole } from '@/lib/authz/permissions';
import { getRunningGame, type Game, type User } from '@/lib/db';

/** A game the caller may act on with their role in it, or the response refusing the action. */
export type GameAccess<G extends Game> =
  | { game: G; role: ScopeRole | null }
  | { response: NextResponse };

/**
 * Load a running game and check that the caller holds a permission in it.
 * A missing or ended game gives 404, in the order of checks of spec 21.
 * @param user The logged-in user
 * @param permission The game permission asked for
 * @param gameId The game
 * @param loadGame Loads the running game (defaults to `getRunningGame`)
 * @returns The game and the caller's role, or the refusal response
 */
export async function authorizeGameAction<G extends Game = Game>(
  user: User,
  permission: GamePermission,
  gameId: string,
  loadGame: (gameId: string) => Promise<G | null> = getRunningGame as (gameId: string) => Promise<G | null>
): Promise<GameAccess<G>> {
  const game = await loadGame(gameId);
  const decision = await authorize(user, permission, { scope: 'game', game });
  if (!decision.allowed) {
    return { response: errorResponse(decision.error, decision.status) };
  }
  // authorize refuses a null game with 404
  return { game: game as G, role: decision.role };
}
