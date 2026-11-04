/**
 * Ownership check shared by the cell routes.
 * Spec Reference: 06-bingo-gameplay.md, 21-authorization.md - Resource Rules, Status Rules
 */

import type { NextResponse } from 'next/server';
import { errorResponse } from '@/app/api/utils';
import { isCardOwner } from '@/lib/authz';
import { getCellCardOwnerId, type User } from '@/lib/db';

/**
 * Check that the caller owns the card a cell is on. Cell routes report every refusal as 400.
 * Joker ids are left to the repositories, which refuse them with their own message.
 * @param user The logged-in user
 * @param cellId The cell
 * @param notOwnerError The message when the caller does not own the card
 * @returns The 400 response refusing the change, or null when the caller owns the card
 */
export async function requireCardOwner(
  user: User,
  cellId: string,
  notOwnerError: string
): Promise<NextResponse | null> {
  if (cellId.startsWith('joker:')) {
    return null;
  }
  const ownerId = await getCellCardOwnerId(cellId);
  if (!ownerId) {
    return errorResponse('Cell not found', 400);
  }
  return isCardOwner(ownerId, user.id) ? null : errorResponse(notOwnerError, 400);
}
