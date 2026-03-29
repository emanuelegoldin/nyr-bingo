import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { findUserById } from '@/lib/db';
import { errorResponse, withAuth, AuthContext } from '@/app/api/utils';

export const GET = withAuth(async (
  _request: NextRequest,
  { params }: AuthContext<{ id: string }>
) => {
  const { id } = await params;
  if (!id) return errorResponse('Missing id', 400);

  const user = await findUserById(id);
  if (!user) return errorResponse('User not found', 404);

  return NextResponse.json({ id: user.id, username: user.username });
});
