/**
 * Unified Resolution Save API
 * Handles creation, updates, and type changes for all personal resolution types.
 *
 * POST /api/resolutions/save — create or update a resolution (supports type changes)
 *
 * Body:
 *   - id?: string               — if provided, this is an update; otherwise a create
 *   - type: 'base' | 'compound' | 'iterative'
 *   - title: string
 *   - text?: string             — description / text (called "text" for base, "description" for others)
 *   - subtasks?: Subtask[]      — required for compound
 *   - numberOfRepetition?: number — required for iterative (>= 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { notifyResolution } from '@/lib/team-signals';
import {
  changeResolutionType,
  createResolution,
  getGameGoalResolution,
  getMemberProvidedResolutionsByUser,
  getResolutionById,
  getRunningGame,
  isTeamLeader,
  isResolutionFrozen,
  isTeamMember,
  logResolutionHistoryEventSafe,
  updateResolutionContent,
} from '@/lib/db';
import type { Game, Resolution, ResolutionContent } from '@/lib/db';
import type { ResolutionScope, ResolutionType, Subtask } from '@/lib/shared/types';
import { AuthContextNoParams, errorResponse, withAuth } from '@/app/api/utils';

/**
 * Validate common fields
 */
function validateCommon(body: Record<string, unknown>): string | null {
  const { title } = body;
  if (!title || typeof title !== 'string' || (title as string).trim().length === 0) {
    return 'Title is required';
  }
  return null;
}

/**
 * Validate compound-specific fields
 */
function validateCompound(body: Record<string, unknown>): string | null {
  const { subtasks } = body;
  if (!Array.isArray(subtasks) || subtasks.length === 0) {
    return 'At least one subtask is required for compound resolutions';
  }
  for (const st of subtasks) {
    if (!st || typeof st !== 'object' || !('title' in st) || typeof (st as Record<string, unknown>).title !== 'string' || !(st as Record<string, string>).title.trim()) {
      return 'Each subtask must have a non-empty title';
    }
  }
  return null;
}

/**
 * Validate iterative-specific fields
 */
function validateIterative(body: Record<string, unknown>): string | null {
  const { numberOfRepetition } = body;
  if (typeof numberOfRepetition !== 'number' || numberOfRepetition < 2) {
    return 'Number of repetitions must be at least 2';
  }
  return null;
}

/**
 * POST /api/resolutions/save
 * Atomically creates/updates a resolution, supporting type changes.
 */
export const POST = withAuth(async (request: NextRequest, { currentUser }: AuthContextNoParams) => {
    const body = await request.json();
  const {
    id,
    type,
    title,
    text,
    subtasks,
    numberOfRepetition,
    scope: rawScope,
    gameId,
    toUserId,
  } = body as {
    id?: string;
    type: string;
    title: string;
    text?: string;
    subtasks?: Subtask[];
    numberOfRepetition?: number;
    scope?: string;
    gameId?: string;
    toUserId?: string;
  };

  const scope = rawScope || 'personal';
  if (!['personal', 'team', 'member_provided'].includes(scope)) {
    return errorResponse('Invalid scope', 400);
  }

  if (!type || !['base', 'compound', 'iterative'].includes(type)) {
    return errorResponse('Invalid resolution type', 400);
  }

  // Common validation
  const commonErr = validateCommon(body);
  if (commonErr) return errorResponse(commonErr, 400);

  // Type-specific validation
  if (type === 'compound') {
    const err = validateCompound(body);
    if (err) return errorResponse(err, 400);
  }
  if (type === 'iterative') {
    const err = validateIterative(body);
    if (err) return errorResponse(err, 400);
  }

  const content: ResolutionContent = {
    type: type as ResolutionType,
    title: title.trim().slice(0, 255),
    text: text?.trim() || '',
    subtasks,
    numberOfRepetition,
  };

  // ── Scope authorization ────────────────────────────────────
  let game: Game | null = null;
  if (scope === 'team' || scope === 'member_provided') {
    if (!gameId) {
      return errorResponse('Game ID is required for this scope', 400);
    }
    game = await getRunningGame(gameId);
    if (!game) {
      return errorResponse('Game not found', 404);
    }
  }

  if (scope === 'team') {
    const leader = await isTeamLeader(game!.teamId, currentUser.id);
    if (!leader) {
      return errorResponse('Only the team leader can set the team goal', 403);
    }
  }

  if (scope === 'member_provided') {
    if (!toUserId) {
      return errorResponse('Target user ID is required', 400);
    }
    if (toUserId === currentUser.id) {
      return errorResponse('You cannot create a resolution for yourself', 400);
    }
    const member = await isTeamMember(game!.teamId, currentUser.id);
    if (!member) {
      return errorResponse('You must be a team member', 403);
    }
    const targetMember = await isTeamMember(game!.teamId, toUserId);
    if (!targetMember) {
      return errorResponse('Target user is not a team member', 400);
    }
  }

  // ── CREATE (no id) ─────────────────────────────────────────
  if (!id) {
    // For team scope, if a goal already exists, update it instead
    if (scope === 'team') {
      const existingGoal = await getGameGoalResolution(game!.id);
      if (existingGoal) {
        return updateExisting(existingGoal, currentUser.id, content);
      }
    }
    // For member_provided scope, if a resolution from→to already exists, update it
    if (scope === 'member_provided') {
      const provided = await getMemberProvidedResolutionsByUser(game!.id, currentUser.id);
      const existingMp = provided.find((resolution) => resolution.toUserId === toUserId);
      if (existingMp) {
        return updateExisting(existingMp, currentUser.id, content);
      }
    }
    return handleCreate(currentUser.id, content, scope as ResolutionScope, game, toUserId);
  }

  // ── UPDATE (with id) ───────────────────────────────────────
  // Verify ownership of existing resolution
  const ownerErr = await verifyOwnership(id, currentUser.id);
  if (ownerErr) return ownerErr;

  const existing = (await getResolutionById(id))!;
  if (await isResolutionFrozen(existing)) {
    return errorResponse('This game has ended', 400);
  }

  return updateExisting(existing, currentUser.id, content);
});

/* ─── Helpers ──────────────────────────────────────────────────────── */

/**
 * Update a resolution, comparing the submitted type with the stored one.
 *
 * @param existing - The stored resolution.
 * @param userId - The user saving it.
 * @param content - The submitted content.
 * @returns The route response.
 */
async function updateExisting(existing: Resolution, userId: string, content: ResolutionContent) {
  // Same type → simple update
  if (existing.resolutionType === content.type) {
    return handleSameTypeUpdate(existing.id, userId, content);
  }

  // Type changed → atomic update of the resolution and its cells
  return handleTypeChange(existing.id, userId, existing.resolutionType, content);
}

async function verifyOwnership(id: string, userId: string): Promise<NextResponse | null> {
  const existing = await getResolutionById(id);

  if (!existing) {
    return errorResponse('Resolution not found', 404);
  }
  if (existing.ownerUserId !== userId) {
    return errorResponse('You can only modify your own resolutions', 403);
  }
  return null;
}

/**
 * Create a new resolution in the unified resolutions table.
 */
async function handleCreate(
  userId: string,
  content: ResolutionContent,
  scope: ResolutionScope,
  game: Game | null,
  toUserId?: string,
) {
  const id = await createResolution(userId, content, {
    scope,
    teamId: game?.teamId,
    gameId: game?.id,
    toUserId,
  });
  const saved = await getResolutionById(id);
  await notifyResolution(id);

  await logResolutionHistoryEventSafe(
    id,
    userId,
    'resolution.created',
    `Created ${content.type} resolution`,
    {
      type: content.type,
      scope,
      teamId: game?.teamId ?? null,
      gameId: game?.id ?? null,
      toUserId: toUserId || null,
    },
  );

  return NextResponse.json({ resolution: toUnifiedResponse(saved!, content.type) }, { status: 201 });
}

/**
 * Update a resolution without changing type.
 */
async function handleSameTypeUpdate(id: string, userId: string, content: ResolutionContent) {
  await updateResolutionContent(id, userId, content);
  const saved = await getResolutionById(id);
  await notifyResolution(id);

  await logResolutionHistoryEventSafe(
    id,
    userId,
    'resolution.updated',
    `Updated ${content.type} resolution`,
    {
      type: content.type,
      title: content.title,
    },
  );

  return NextResponse.json({ resolution: toUnifiedResponse(saved!, content.type) });
}

/**
 * Change resolution type: update the single resolutions row and any bingo_cells referencing it.
 */
async function handleTypeChange(id: string, userId: string, oldType: string, content: ResolutionContent) {
  await changeResolutionType(id, userId, content);
  const saved = await getResolutionById(id);
  await notifyResolution(id);

  if (!saved) {
    return errorResponse('Failed to save resolution', 500);
  }

  await logResolutionHistoryEventSafe(
    id,
    userId,
    'resolution.type_changed',
    `Changed resolution type from ${oldType} to ${content.type}`,
    {
      oldType,
      newType: content.type,
      title: content.title,
    },
  );

  return NextResponse.json({ resolution: toUnifiedResponse(saved, content.type) });
}

/**
 * Convert a resolution + the requested type into a unified response object
 * that the frontend can use regardless of type.
 */
function toUnifiedResponse(resolution: Resolution, type: ResolutionType) {
  const base = {
    id: resolution.id,
    type,
    ownerUserId: resolution.ownerUserId,
    title: resolution.title,
    text: resolution.description ?? '',
    createdAt: resolution.createdAt,
    updatedAt: resolution.updatedAt,
  };

  if (type === 'compound') {
    return { ...base, subtasks: resolution.subtasks };
  }

  if (type === 'iterative') {
    return {
      ...base,
      numberOfRepetition: resolution.numberOfRepetition,
      completedTimes: resolution.completedTimes,
    };
  }

  return base;
}
