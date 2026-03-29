/**
 * Team Start Bingo API
 * Spec Reference: 04-bingo-teams.md - Start Conditions
 */

import { NextRequest, NextResponse } from 'next/server';
import { isUserVerified } from '@/lib/auth';
import {
  startBingoGame,
  isTeamLeader,
  getTeamWithMembers,
  initializeTeamLeaderboard,
} from '@/lib/db';
import { generateBingoCardsForTeam } from '@/lib/db/bingo-card-repository';
import { AuthContext, errorResponse, withAuth } from '@/app/api/utils';

/**
 * POST /api/teams/[teamId]/start - Start the bingo game
 * Spec: 04-bingo-teams.md - Team leader can start bingo once all members created resolutions
 * Requires email verification
 */
export const POST = withAuth(async (
  request: NextRequest,
  { params, currentUser }: AuthContext<{ teamId: string }>
) => {
    // Check if user has verified their email
  // Unverified users can only write resolutions and update their profiles
  if (!isUserVerified(currentUser)) {
    return errorResponse('Email verification required. Please verify your email before starting a game.', 403);
  }

  const { teamId } = await params;

  // Check if user is team leader
  // Spec: 04-bingo-teams.md - Only team leader can start game
  const isLeader = await isTeamLeader(teamId, currentUser.id);
  if (!isLeader) {
    return errorResponse('Only the team leader can start the game', 403);
  }

  // Start the game (validates all conditions)
  const result = await startBingoGame(teamId, currentUser.id);

  if (!result.success) {
    return errorResponse(result.error, 400);
  }

  // Generate bingo cards for all members
  // Spec: 05-bingo-card-generation.md - Cards generated automatically at start
  await generateBingoCardsForTeam(teamId);

  // Get updated team data
  const team = await getTeamWithMembers(teamId);

  // Initialize persisted leaderboard rows for all team members
  if (team) {
    const memberIds = team.members.map((m) => m.user.userId);
    await initializeTeamLeaderboard(teamId, memberIds);
  }

  return NextResponse.json({
    message: 'Bingo game started successfully',
    team,
  });
});