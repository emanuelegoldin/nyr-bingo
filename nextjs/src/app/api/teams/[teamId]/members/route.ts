import { AuthContext, errorResponse, withAuth } from "@/app/api/utils";
import { getTeamWithMembers, isTeamMember, User } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/teams/[teamId]/members - Get all team member's usernames
 */
export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
  const { teamId } = await params;

  const isMember = await isTeamMember(teamId, currentUser.id);
  if (!isMember) {
    return errorResponse('You are not a member of this team', 403);
  }

  // Get full team data with members for each team
  const teamWithMembers = await getTeamWithMembers(teamId);
  const members: Record<string, string> = Object.fromEntries(
    (teamWithMembers?.members ?? []).map((m) => [m.user.id, m.user.username])
  );
  return NextResponse.json({
    members
  });
});