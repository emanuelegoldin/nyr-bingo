/**
 * Unified Resolution Save API
 * Handles creation, updates, and type changes for all personal resolution types.
 *
 * POST /api/resolutions/save — create or update a resolution (supports type changes)
 *
 * Body:
 *   - id?: string               — if provided, this is an update; otherwise a create
 *   - previousType?: string     — the old resolution type (required if changing types on update)
 *   - type: 'base' | 'compound' | 'iterative'
 *   - title: string
 *   - text?: string             — description / text (called "text" for base, "description" for others)
 *   - subtasks?: Subtask[]      — required for compound
 *   - numberOfRepetition?: number — required for iterative (>= 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getConnection, query, isTeamLeader, isTeamMember } from '@/lib/db';
import { getResolutionById } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import type { Subtask } from '@/lib/shared/types';

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
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      previousType,
      type,
      title,
      text,
      subtasks,
      numberOfRepetition,
      scope: rawScope,
      teamId,
      toUserId,
    } = body as {
      id?: string;
      previousType?: string;
      type: string;
      title: string;
      text?: string;
      subtasks?: Subtask[];
      numberOfRepetition?: number;
      scope?: string;
      teamId?: string;
      toUserId?: string;
    };

    const scope = rawScope || 'personal';
    if (!['personal', 'team', 'member_provided'].includes(scope)) {
      return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
    }

    if (!type || !['base', 'compound', 'iterative'].includes(type)) {
      return NextResponse.json({ error: 'Invalid resolution type' }, { status: 400 });
    }

    // Common validation
    const commonErr = validateCommon(body);
    if (commonErr) return NextResponse.json({ error: commonErr }, { status: 400 });

    // Type-specific validation
    if (type === 'compound') {
      const err = validateCompound(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (type === 'iterative') {
      const err = validateIterative(body);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    const trimmedTitle = title.trim().slice(0, 255);
    const trimmedText = text?.trim() || '';

    // ── Scope authorization ────────────────────────────────────
    if (scope === 'team') {
      if (!teamId) {
        return NextResponse.json({ error: 'Team ID is required for team scope' }, { status: 400 });
      }
      const leader = await isTeamLeader(teamId, currentUser.id);
      if (!leader) {
        return NextResponse.json({ error: 'Only the team leader can set the team goal' }, { status: 403 });
      }
    }

    if (scope === 'member_provided') {
      if (!teamId || !toUserId) {
        return NextResponse.json({ error: 'Team ID and target user ID are required' }, { status: 400 });
      }
      if (toUserId === currentUser.id) {
        return NextResponse.json({ error: 'You cannot create a resolution for yourself' }, { status: 400 });
      }
      const member = await isTeamMember(teamId, currentUser.id);
      if (!member) {
        return NextResponse.json({ error: 'You must be a team member' }, { status: 403 });
      }
      const targetMember = await isTeamMember(teamId, toUserId);
      if (!targetMember) {
        return NextResponse.json({ error: 'Target user is not a team member' }, { status: 400 });
      }
    }

    // ── CREATE (no id) ─────────────────────────────────────────
    if (!id) {
      // For team scope, if a goal already exists, update it instead
      if (scope === 'team') {
        const [existingGoal] = await query<Array<Record<string, unknown>>>(
          `SELECT id FROM resolutions WHERE team_id = ? AND scope = 'team' LIMIT 1`,
          [teamId]
        );
        if (existingGoal) {
          return handleSameTypeUpdate(
            existingGoal.id as string, currentUser.id, type, trimmedTitle, trimmedText, subtasks, numberOfRepetition
          );
        }
      }
      // For member_provided scope, if a resolution from→to already exists, update it
      if (scope === 'member_provided') {
        const [existingMp] = await query<Array<Record<string, unknown>>>(
          `SELECT id FROM resolutions WHERE team_id = ? AND owner_user_id = ? AND to_user_id = ? AND scope = 'member_provided' LIMIT 1`,
          [teamId, currentUser.id, toUserId]
        );
        if (existingMp) {
          return handleSameTypeUpdate(
            existingMp.id as string, currentUser.id, type, trimmedTitle, trimmedText, subtasks, numberOfRepetition
          );
        }
      }
      return handleCreate(currentUser.id, type, trimmedTitle, trimmedText, subtasks, numberOfRepetition, scope, teamId, toUserId);
    }

    // ── UPDATE (with id) ───────────────────────────────────────
    const effectivePrevType = previousType || type;

    // Verify ownership of existing resolution
    const ownerErr = await verifyOwnership(id, effectivePrevType, currentUser.id);
    if (ownerErr) return ownerErr;

    // Same type → simple update
    if (effectivePrevType === type) {
      return handleSameTypeUpdate(id, currentUser.id, type, trimmedTitle, trimmedText, subtasks, numberOfRepetition);
    }

    // Type changed → atomic delete-from-old + insert-into-new
    return handleTypeChange(id, currentUser.id, effectivePrevType, type, trimmedTitle, trimmedText, subtasks, numberOfRepetition, scope, teamId, toUserId);
  } catch (error) {
    console.error('Resolution save error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

async function verifyOwnership(id: string, type: string, userId: string): Promise<NextResponse | null> {
  const existing = await getResolutionById(id);

  if (!existing) {
    return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
  }
  if (existing.ownerUserId !== userId) {
    return NextResponse.json({ error: 'You can only modify your own resolutions' }, { status: 403 });
  }
  return null;
}

/**
 * Create a new resolution in the unified resolutions table.
 */
async function handleCreate(
  userId: string,
  type: string,
  title: string,
  text: string,
  subtasks?: Subtask[],
  numberOfRepetition?: number,
  scope: string = 'personal',
  teamId?: string,
  toUserId?: string,
) {
  const id = uuidv4();
  const description = type === 'base' ? (text || title) : (text || null);

  if (type === 'base') {
    await query(
      `INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope, team_id, to_user_id)
       VALUES (?, ?, ?, ?, 'base', ?, ?, ?)`,
      [id, userId, title, description, scope, teamId || null, toUserId || null]
    );
  } else if (type === 'compound') {
    const normalizedSubtasks = normalizeSubtasks(subtasks!);
    await query(
      `INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope, team_id, to_user_id, subtasks)
       VALUES (?, ?, ?, ?, 'compound', ?, ?, ?, ?)`,
      [id, userId, title, description, scope, teamId || null, toUserId || null, JSON.stringify(normalizedSubtasks)]
    );
  } else {
    // iterative
    await query(
      `INSERT INTO resolutions (id, owner_user_id, title, description, resolution_type, scope, team_id, to_user_id, number_of_repetition, completed_times)
       VALUES (?, ?, ?, ?, 'iterative', ?, ?, ?, ?, 0)`,
      [id, userId, title, description, scope, teamId || null, toUserId || null, numberOfRepetition!]
    );
  }

  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT * FROM resolutions WHERE id = ?`, [id]
  );
  return NextResponse.json({ resolution: toUnifiedResponse(rows[0], type) }, { status: 201 });
}

/**
 * Update a resolution without changing type.
 */
async function handleSameTypeUpdate(
  id: string,
  userId: string,
  type: string,
  title: string,
  text: string,
  subtasks?: Subtask[],
  numberOfRepetition?: number,
) {
  const description = type === 'base' ? (text || title) : (text || null);

  if (type === 'base') {
    await query(
      `UPDATE resolutions SET title = ?, description = ? WHERE id = ? AND owner_user_id = ?`,
      [title, description, id, userId]
    );
  } else if (type === 'compound') {
    const normalizedSubtasks = normalizeSubtasks(subtasks!);
    await query(
      `UPDATE resolutions SET title = ?, description = ?, subtasks = ?
       WHERE id = ? AND owner_user_id = ?`,
      [title, description, JSON.stringify(normalizedSubtasks), id, userId]
    );
  } else {
    // iterative
    await query(
      `UPDATE resolutions SET title = ?, description = ?, number_of_repetition = ?
       WHERE id = ? AND owner_user_id = ?`,
      [title, description, numberOfRepetition!, id, userId]
    );
  }

  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT * FROM resolutions WHERE id = ?`, [id]
  );
  return NextResponse.json({ resolution: toUnifiedResponse(rows[0], type) });
}

/**
 * Change resolution type: update the single resolutions row and any bingo_cells referencing it.
 * Since all types live in the same table, this is a single UPDATE + cell update.
 */
async function handleTypeChange(
  id: string,
  userId: string,
  oldType: string,
  newType: string,
  title: string,
  text: string,
  subtasks?: Subtask[],
  numberOfRepetition?: number,
  _scope?: string,
  _teamId?: string,
  _toUserId?: string,
) {
  const conn = await getConnection();
  const description = newType === 'base' ? (text || title) : (text || null);

  try {
    await conn.beginTransaction();

    // Update the resolution row: change type and type-specific fields
    if (newType === 'base') {
      await conn.execute(
        `UPDATE resolutions SET title = ?, description = ?, resolution_type = 'base',
         subtasks = NULL, number_of_repetition = NULL, completed_times = 0
         WHERE id = ? AND owner_user_id = ?`,
        [title, description, id, userId]
      );
    } else if (newType === 'compound') {
      const normalizedSubtasks = normalizeSubtasks(subtasks!);
      await conn.execute(
        `UPDATE resolutions SET title = ?, description = ?, resolution_type = 'compound',
         subtasks = ?, number_of_repetition = NULL, completed_times = 0
         WHERE id = ? AND owner_user_id = ?`,
        [title, description, JSON.stringify(normalizedSubtasks), id, userId]
      );
    } else {
      // iterative
      await conn.execute(
        `UPDATE resolutions SET title = ?, description = ?, resolution_type = 'iterative',
         subtasks = NULL, number_of_repetition = ?, completed_times = 0
         WHERE id = ? AND owner_user_id = ?`,
        [title, description, numberOfRepetition!, id, userId]
      );
    }

    // Update bingo_cells.resolution_type for any cells referencing this resolution
    await conn.execute(
      `UPDATE bingo_cells SET resolution_type = ? WHERE resolution_id = ?`,
      [newType, id]
    );

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT * FROM resolutions WHERE id = ?`, [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Failed to save resolution' }, { status: 500 });
  }

  return NextResponse.json({ resolution: toUnifiedResponse(rows[0], newType) });
}

/**
 * Normalize subtasks: ensure correct shape, trim strings.
 */
function normalizeSubtasks(subtasks: Subtask[]): Subtask[] {
  return subtasks.map((st) => ({
    title: st.title.trim(),
    description: st.description?.trim() ?? '',
    completed: st.completed ?? false,
  }));
}

/**
 * Convert a raw DB row + type into a unified response object
 * that the frontend can use regardless of type.
 */
function toUnifiedResponse(row: Record<string, unknown>, type: string) {
  const base = {
    id: row.id,
    type,
    ownerUserId: row.owner_user_id,
    title: row.title,
    text: (row.description as string) ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (type === 'compound') {
    let subtasks: Subtask[];
    try {
      subtasks = typeof row.subtasks === 'string' ? JSON.parse(row.subtasks as string) : (row.subtasks as Subtask[]);
    } catch {
      subtasks = [];
    }
    return { ...base, subtasks };
  }

  if (type === 'iterative') {
    return {
      ...base,
      numberOfRepetition: row.number_of_repetition,
      completedTimes: row.completed_times,
    };
  }

  return base;
}
