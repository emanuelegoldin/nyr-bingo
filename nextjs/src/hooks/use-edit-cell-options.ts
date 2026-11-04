"use client";

import { apiFetch, toastApiError } from "@/lib/api-client";
import type { BingoCellWithThread } from "@/lib/db/types";
import { CellSourceType, ResolutionType } from "@/lib/shared/types";
import { useEffect, useState } from "react";

/** A resolution that can replace the content of a cell. */
export type EditOption = {
  key: string;
  label: string;
  resolutionText: string;
  resolutionId: string | null;
  resolutionType: ResolutionType;
  sourceType: CellSourceType;
  sourceUserId: string | null;
  isEmpty: boolean;
};

/** Item of `GET /api/resolutions/all` used to build personal options. */
interface PersonalResolutionItem {
  id: string;
  title: string;
  text: string;
  type?: string;
}

/** Item of `GET /api/games/:id/resolutions` used to build member-provided options. */
interface TeamResolutionItem {
  id: string;
  title: string;
  description: string;
  resolutionType?: string;
  ownerUserId?: string | null;
}

interface UseEditCellOptionsParams {
  existingCells: BingoCellWithThread[];
  gameId: string;
  currentUserId: string;
  /** Options are (re)loaded whenever the dialog's open state or any other parameter changes. */
  isOpen: boolean;
}

/**
 * Loads the resolutions a cell can be replaced with: the user's own resolutions
 * plus, when a game is given, the ones provided by team members. Resolutions already
 * used by another cell of the card are left out. Failures are reported with a destructive toast.
 *
 * @param params - Card, game and user the options are loaded for, and the dialog's open state.
 * @returns The options, the loading flag and a `reset` that clears both.
 */
export const useEditCellOptions = ({
  existingCells,
  gameId,
  currentUserId,
  isOpen
}: UseEditCellOptionsParams) => {
  const [isLoading, setIsLoading] = useState(false);
  const [editOptions, setEditOptions] = useState<EditOption[]>([]);

  useEffect(() => {
    const loadEditOptions = async () => {
      const occupiedKeys = new Set<string>(
        (Array.isArray(existingCells) ? existingCells : [])
          .filter((c: BingoCellWithThread) => !c.isJoker && !c.isEmpty)
          .map((c: BingoCellWithThread) => {
            if (c.sourceType === CellSourceType.PERSONAL && c.resolutionId) return `personal:${c.resolutionId}`;
            if (c.sourceType === CellSourceType.MEMBER_PROVIDED && c.resolutionId) return `member_provided:${c.resolutionId}`;
            // "team" and "empty" cells do not have a stable resolution id reference.
            return null;
          })
          .filter((v: string | null): v is string => typeof v === 'string' && v.length > 0)
      );

      setIsLoading(true);
      // Fetch ALL resolution types (base + compound + iterative) via the unified endpoint
      const teamReq = gameId && currentUserId
        ? apiFetch<{ resolutions?: TeamResolutionItem[] }>(
          `/api/games/${gameId}/resolutions?toUserId=${encodeURIComponent(currentUserId)}`
        )
        : Promise.resolve(null);
      const [personalResult, teamResult] = await Promise.all([
        apiFetch<{ resolutions?: PersonalResolutionItem[] }>('/api/resolutions/all'),
        teamReq,
      ]);
      setIsLoading(false);

      if (!personalResult.ok) {
        toastApiError(personalResult, 'Failed to load personal resolutions', 'Failed to load replacement options');
        return;
      }
      if (teamResult && !teamResult.ok) {
        toastApiError(teamResult, 'Failed to load team-provided resolutions', 'Failed to load replacement options');
        return;
      }

      const personalOptions: EditOption[] = (personalResult.data.resolutions || [])
        .map((r) => ({
          key: `personal:${r.id}`,
          label: r.title || r.text || r.title,
          resolutionText: r.text || r.title,
          resolutionId: typeof r.id === 'string' ? r.id : null,
          resolutionType: (r.type as ResolutionType) ?? ResolutionType.BASE,
          sourceType: CellSourceType.PERSONAL,
          sourceUserId: currentUserId ?? null,
          isEmpty: false,
        }))
        // Prevent duplicates: do not allow selecting texts already used in other non-empty cells
        // Spec: 05-bingo-card-generation.md - No duplicates in a card
        .filter((opt) => !occupiedKeys.has(opt.key));

      const teamOptions: EditOption[] = (teamResult?.data.resolutions || [])
        .map((r) => ({
          key: `member_provided:${r.id}`,
          label: r.title || r.description,
          resolutionText: r.description || r.title,
          resolutionId: typeof r.id === 'string' ? r.id : null,
          resolutionType: (r.resolutionType as ResolutionType) ?? ResolutionType.BASE,
          sourceType: CellSourceType.MEMBER_PROVIDED,
          sourceUserId: typeof r.ownerUserId === 'string' ? r.ownerUserId : null,
          isEmpty: false,
        }))
        // Prevent duplicates: do not allow selecting texts already used in other non-empty cells
        .filter((opt) => !occupiedKeys.has(opt.key));

      setEditOptions([...teamOptions, ...personalOptions]);
    };

    loadEditOptions();
  }, [isOpen, gameId, currentUserId, existingCells]);

  /** Clears the loaded options and loading flag. */
  const reset = () => {
    setIsLoading(false);
    setEditOptions([]);
  };

  return { editOptions, isLoading, reset };
};
