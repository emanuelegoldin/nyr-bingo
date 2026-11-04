/**
 * Authorization helpers for API routes and server pages.
 * Spec Reference: 21-authorization.md - Status Rules
 */

import { notFound } from 'next/navigation';
import type { NextResponse } from 'next/server';
import { errorResponse } from '@/app/api/utils';
import type { User } from '@/lib/db/types';
import type { Permission, ScopeRole } from './permissions';
import { authorize, type TargetFor } from './policy';

/**
 * Check a permission in an API route.
 * @param user The logged-in user
 * @param permission The permission asked for
 * @param target The team, game or archived game it applies to, or no scope
 * @returns The error response to return, or null when the user holds the permission
 */
export async function requirePermission<P extends Permission>(
  user: User,
  permission: P,
  target: TargetFor<P>
): Promise<NextResponse | null> {
  const decision = await authorize(user, permission, target);
  return decision.allowed ? null : errorResponse(decision.error, decision.status);
}

/**
 * Check a permission in a server page. A refusal shows the not-found page.
 * @param user The logged-in user
 * @param permission The permission asked for
 * @param target The team, game or archived game it applies to
 * @returns The user's role in the target (never returns on refusal)
 */
export async function requirePagePermission<P extends Permission>(
  user: User,
  permission: P,
  target: TargetFor<P>
): Promise<ScopeRole | null> {
  const decision = await authorize(user, permission, target);
  if (!decision.allowed) {
    notFound();
  }
  return decision.role;
}
