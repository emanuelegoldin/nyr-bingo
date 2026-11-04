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
import { getGameRole, isResolutionOwner, requirePermission } from '@/lib/authz';
import { notifyResolution } from '@/lib/team-signals';
import {
  changeResolutionType,
  createResolution,
  getGameGoalResolution,
  getMemberProvidedResolutionsByUser,
  getResolutionById,
  getRunningGame,
  isResolutionFrozen,
  logResolutionHistoryEventSafe,
  updateResolutionContent,
} from '@/lib/db';
import type { Game, Resolution, ResolutionContent } from '@/lib/db';
import type { ResolutionScope, ResolutionType, Subtask } from '@/lib/shared/types';
import { toUnifiedResolution } from '@/lib/shared/resolution-form';
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
    const denied = await requirePermission(currentUser, 'game.goal.set', { scope: 'game', game });
    if (denied) return denied;
  }

  if (scope === 'member_provided') {
    if (!toUserId) {
      return errorResponse('Target user ID is required', 400);
    }
    if (toUserId === currentUser.id) {
      return errorResponse('You cannot create a resolution for yourself', 400);
    }
    const denied = await requirePermission(currentUser, 'game.propose', { scope: 'game', game });
    if (denied) return denied;
    // Spec: 16-games.md - the target must also be a player of the game
    if (!(await getGameRole(game!.id, toUserId))) {
      return errorResponse('Target user is not a player of this game', 400);
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
  const owned = await loadOwnedResolution(id, currentUser.id);
  if ('response' in owned) return owned.response;

  const existing = owned.resolution;
  if (await isResolutionFrozen(existing)) {
    return errorResponse('This game has ended', 400);
  }

  return updateExisting(existing, currentUser.id, content);
});

/* ─── Helpers ──────────────────────────────────────────────────────── */

/** History entry logged after a successful save. */
interface SaveEvent {
  key: string;
  content: string;
  metadata: Record<string, unknown>;
}

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
    await updateResolutionContent(existing.id, userId, content);
    return respondWithSaved(existing.id, userId, {
      key: 'resolution.updated',
      content: `Updated ${content.type} resolution`,
      metadata: { type: content.type, title: content.title },
    });
  }

  // Type changed → atomic update of the resolution and its cells
  await changeResolutionType(existing.id, userId, content);
  return respondWithSaved(existing.id, userId, {
    key: 'resolution.type_changed',
    content: `Changed resolution type from ${existing.resolutionType} to ${content.type}`,
    metadata: { oldType: existing.resolutionType, newType: content.type, title: content.title },
  });
}

/**
 * Load a resolution and check that it belongs to the user saving it.
 * Spec: 21-authorization.md - Resource Rules (Ownership)
 *
 * @param id - The resolution to update.
 * @param userId - The user saving it.
 * @returns The resolution, or the 404/403 response to return.
 */
async function loadOwnedResolution(
  id: string,
  userId: string
): Promise<{ resolution: Resolution } | { response: NextResponse }> {
  const resolution = await getResolutionById(id);

  if (!resolution) {
    return { response: errorResponse('Resolution not found', 404) };
  }
  if (!isResolutionOwner(resolution, userId)) {
    return { response: errorResponse('You can only modify your own resolutions', 403) };
  }
  return { resolution };
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

  return respondWithSaved(id, userId, {
    key: 'resolution.created',
    content: `Created ${content.type} resolution`,
    metadata: {
      type: content.type,
      scope,
      teamId: game?.teamId ?? null,
      gameId: game?.id ?? null,
      toUserId: toUserId || null,
    },
  }, 201);
}

/**
 * Signal a saved resolution, log its history entry and return it.
 *
 * @param id - The saved resolution.
 * @param userId - The user who saved it.
 * @param event - The history entry to log.
 * @param status - HTTP status of the response.
 * @returns The saved resolution in the unified shape, or 500 when it cannot be read back.
 */
async function respondWithSaved(id: string, userId: string, event: SaveEvent, status = 200) {
  const saved = await getResolutionById(id);
  await notifyResolution(id);

  if (!saved) {
    return errorResponse('Failed to save resolution', 500);
  }

  await logResolutionHistoryEventSafe(id, userId, event.key, event.content, event.metadata);

  return NextResponse.json({ resolution: toUnifiedResolution(saved) }, { status });
}
