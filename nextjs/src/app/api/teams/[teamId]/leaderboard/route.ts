/**
 * Team Leaderboard API
 * Spec Reference: 12-team-tabs.md
 *
 * Returns persisted leaderboard data for a team from the
 * team_leaderboard table (joined with users for display info).
 */

import { NextRequest, NextResponse } from "next/server";
import { isTeamMember, getTeamLeaderboard, User } from "@/lib/db";
import { withAuth } from "@/app/api/utils";

// ── Route handler ─────────────────────────────────────────────────

export const GET = withAuth(async (
  _request: NextRequest,
  { params, currentUser }: { params: Promise<{ teamId: string }>; currentUser: User }
) => {
  const { teamId } = await params;

  const isMember = await isTeamMember(teamId, currentUser.id);
  if (!isMember) {
    return NextResponse.json({ error: "You are not a member of this team" }, { status: 403 });
  }

  const leaderboard = await getTeamLeaderboard(teamId);

  return NextResponse.json({ leaderboard });
});
