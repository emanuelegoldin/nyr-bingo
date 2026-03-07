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
import { getConnection, query } from '@/lib/db';
import {
  getResolutionById,
  getCompoundResolutionById,
  getIterativeResolutionById,
} from '@/lib/db';
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
    } = body as {
      id?: string;
      previousType?: string;
      type: string;
      title: string;
      text?: string;
      subtasks?: Subtask[];
      numberOfRepetition?: number;
    };

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

    // ── CREATE (no id) ─────────────────────────────────────────
    if (!id) {
      return handleCreate(currentUser.id, type, trimmedTitle, trimmedText, subtasks, numberOfRepetition);
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
    return handleTypeChange(id, currentUser.id, effectivePrevType, type, trimmedTitle, trimmedText, subtasks, numberOfRepetition);
  } catch (error) {
    console.error('Resolution save error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}

/* ─── Helpers ──────────────────────────────────────────────────────── */

async function verifyOwnership(id: string, type: string, userId: string): Promise<NextResponse | null> {
  let existing: { ownerUserId: string } | null = null;

  if (type === 'base') {
    existing = await getResolutionById(id);
  } else if (type === 'compound') {
    existing = await getCompoundResolutionById(id);
  } else if (type === 'iterative') {
    existing = await getIterativeResolutionById(id);
  }

  if (!existing) {
    return NextResponse.json({ error: 'Resolution not found' }, { status: 404 });
  }
  if (existing.ownerUserId !== userId) {
    return NextResponse.json({ error: 'You can only modify your own resolutions' }, { status: 403 });
  }
  return null;
}

/**
 * Create a new resolution in the appropriate table.
 */
async function handleCreate(
  userId: string,
  type: string,
  title: string,
  text: string,
  subtasks?: Subtask[],
  numberOfRepetition?: number,
) {
  const id = uuidv4();

  if (type === 'base') {
    const descOrTitle = text || title;
    await query(
      `INSERT INTO resolutions (id, owner_user_id, title, text) VALUES (?, ?, ?, ?)`,
      [id, userId, title, descOrTitle]
    );
    const rows = await query<Array<Record<string, unknown>>>(
      `SELECT * FROM resolutions WHERE id = ?`, [id]
    );
    return NextResponse.json({ resolution: toUnifiedResponse(rows[0], 'base') }, { status: 201 });
  }

  if (type === 'compound') {
    const normalizedSubtasks = normalizeSubtasks(subtasks!);
    await query(
      `INSERT INTO compound_resolutions (id, owner_user_id, title, description, subtasks)
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, title, text || null, JSON.stringify(normalizedSubtasks)]
    );
    const rows = await query<Array<Record<string, unknown>>>(
      `SELECT * FROM compound_resolutions WHERE id = ?`, [id]
    );
    return NextResponse.json({ resolution: toUnifiedResponse(rows[0], 'compound') }, { status: 201 });
  }

  // iterative
  await query(
    `INSERT INTO iterative_resolutions (id, owner_user_id, title, description, number_of_repetition, completed_times)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [id, userId, title, text || null, numberOfRepetition!]
  );
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT * FROM iterative_resolutions WHERE id = ?`, [id]
  );
  return NextResponse.json({ resolution: toUnifiedResponse(rows[0], 'iterative') }, { status: 201 });
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
  if (type === 'base') {
    const descOrTitle = text || title;
    await query(
      `UPDATE resolutions SET title = ?, text = ? WHERE id = ? AND owner_user_id = ?`,
      [title, descOrTitle, id, userId]
    );
    const rows = await query<Array<Record<string, unknown>>>(
      `SELECT * FROM resolutions WHERE id = ?`, [id]
    );
    return NextResponse.json({ resolution: toUnifiedResponse(rows[0], 'base') });
  }

  if (type === 'compound') {
    const normalizedSubtasks = normalizeSubtasks(subtasks!);
    await query(
      `UPDATE compound_resolutions SET title = ?, description = ?, subtasks = ?
       WHERE id = ? AND owner_user_id = ?`,
      [title, text || null, JSON.stringify(normalizedSubtasks), id, userId]
    );
    const rows = await query<Array<Record<string, unknown>>>(
      `SELECT * FROM compound_resolutions WHERE id = ?`, [id]
    );
    return NextResponse.json({ resolution: toUnifiedResponse(rows[0], 'compound') });
  }

  // iterative
  await query(
    `UPDATE iterative_resolutions SET title = ?, description = ?, number_of_repetition = ?
     WHERE id = ? AND owner_user_id = ?`,
    [title, text || null, numberOfRepetition!, id, userId]
  );
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT * FROM iterative_resolutions WHERE id = ?`, [id]
  );
  return NextResponse.json({ resolution: toUnifiedResponse(rows[0], 'iterative') });
}

/**
 * Atomically change resolution type: delete from old table, insert with the SAME id into new table,
 * and update any bingo_cells referencing this resolution.
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
) {
  const conn = await getConnection();

  try {
    await conn.beginTransaction();

    // 1. Delete from old table
    const oldTable = tableForType(oldType);
    await conn.execute(`DELETE FROM ${oldTable} WHERE id = ? AND owner_user_id = ?`, [id, userId]);

    // 2. Insert into new table with SAME id
    if (newType === 'base') {
      const descOrTitle = text || title;
      await conn.execute(
        `INSERT INTO resolutions (id, owner_user_id, title, text) VALUES (?, ?, ?, ?)`,
        [id, userId, title, descOrTitle]
      );
    } else if (newType === 'compound') {
      const normalizedSubtasks = normalizeSubtasks(subtasks!);
      await conn.execute(
        `INSERT INTO compound_resolutions (id, owner_user_id, title, description, subtasks) VALUES (?, ?, ?, ?, ?)`,
        [id, userId, title, text || null, JSON.stringify(normalizedSubtasks)]
      );
    } else {
      // iterative
      await conn.execute(
        `INSERT INTO iterative_resolutions (id, owner_user_id, title, description, number_of_repetition, completed_times) VALUES (?, ?, ?, ?, ?, 0)`,
        [id, userId, title, text || null, numberOfRepetition!]
      );
    }

    // 3. Update bingo_cells.resolution_type for any cells referencing this resolution
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

  // Fetch the newly inserted row
  const newTable = tableForType(newType);
  const rows = await query<Array<Record<string, unknown>>>(
    `SELECT * FROM ${newTable} WHERE id = ?`, [id]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Failed to save resolution' }, { status: 500 });
  }

  return NextResponse.json({ resolution: toUnifiedResponse(rows[0], newType) });
}

/**
 * Map a resolution type to its database table name.
 */
function tableForType(type: string): string {
  switch (type) {
    case 'base': return 'resolutions';
    case 'compound': return 'compound_resolutions';
    case 'iterative': return 'iterative_resolutions';
    default: throw new Error(`Unknown resolution type: ${type}`);
  }
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
    text: (row.text as string) ?? (row.description as string) ?? '',
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
