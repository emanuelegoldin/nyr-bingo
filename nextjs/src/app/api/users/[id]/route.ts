import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { findUserById, User } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '../../utils';

export const GET = withAuth(async (
  request: NextRequest,
  { params, currentUser }: { params: Promise<{ id: string }>; currentUser: User }
) => {
  const { id } = await params;
  if (!id) return errorResponse('Missing id', 400);

  const user = await findUserById(id);
  if (!user) return errorResponse('User not found', 404);

  return NextResponse.json({ id: user.id, username: user.username });
});
