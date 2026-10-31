"use client";

import { useToast } from "@/hooks/use-toast";
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

/** Item of `GET /api/teams/:id/resolutions` used to build team-provided options. */
interface TeamResolutionItem {
  id: string;
  title: string;
  description: string;
  resolutionType?: string;
  ownerUserId?: string | null;
}

interface UseEditCellOptionsParams {
  cellId: string;
  existingCells: BingoCellWithThread[];
  teamId: string;
  currentUserId: string;
  /** Options are (re)loaded whenever the dialog's open state or any other parameter changes. */
  isOpen: boolean;
}

/**
 * Loads the resolutions a cell can be replaced with: the user's own resolutions
 * plus, when a team is given, the ones provided by team members (and the member
 * usernames used to label them). Resolutions already used by another cell of the
 * card are left out. Failures are reported with a destructive toast.
 *
 * @param params - Cell, card, team and user the options are loaded for, and the dialog's open state.
 * @returns The options, the team member usernames, the loading flag and a `reset` that clears all three.
 */
export const useEditCellOptions = ({
  cellId,
  existingCells,
  teamId,
  currentUserId,
  isOpen
}: UseEditCellOptionsParams) => {
  const [isLoading, setIsLoading] = useState(false);
  const [editOptions, setEditOptions] = useState<EditOption[]>([]);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const { toast } = useToast();

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
      try {
        // Fetch ALL resolution types (base + compound + iterative) via the unified endpoint
        const personalReq = fetch('/api/resolutions/all');
        const teamReq = teamId && currentUserId
          ? fetch(`/api/teams/${teamId}/resolutions?toUserId=${encodeURIComponent(currentUserId)}`) // TODO: try to remove dependency to avoid passing teamid
          : null;

        const [personalRes, teamRes] = await Promise.all([
          personalReq,
          teamReq ?? Promise.resolve(null as unknown as Response | null),
        ]);

        const personalData = await personalRes.json().catch(() => ({}));
        if (!personalRes.ok) {
          toast({
            title: 'Error',
            description: personalData?.error || 'Failed to load personal resolutions',
            variant: 'destructive',
          });
          return;
        }

        const personalOptions: EditOption[] = (personalData?.resolutions || [])
          .map((r: PersonalResolutionItem) => ({
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
          .filter((opt: EditOption) => !occupiedKeys.has(opt.key));

        let teamOptions: EditOption[] = [];
        if (teamRes) {
          const teamData = await teamRes.json().catch(() => ({}));
          if (!teamRes.ok) {
            toast({
              title: 'Error',
              description: teamData?.error || 'Failed to load team-provided resolutions',
              variant: 'destructive',
            });
            return;
          }

          teamOptions = (teamData?.resolutions || [])
            .map((r: TeamResolutionItem) => ({
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
            .filter((opt: EditOption) => !occupiedKeys.has(opt.key));

          const teamMemberUsernamesRes = await fetch(`/api/teams/${teamId}/members`);

          const teamMemberUsernamesData: { members?: Record<string, string>; error?: string } =
            await teamMemberUsernamesRes.json().catch(() => ({}));

          if (!teamMemberUsernamesRes.ok) {
            toast({
              title: 'Error',
              description: teamMemberUsernamesData?.error || 'Failed to load team member usernames',
              variant: 'destructive',
            });
            return;
          }
          setUsernames(teamMemberUsernamesData.members ?? {});
        }

        setEditOptions([...teamOptions, ...personalOptions]);
      } catch {
        toast({
          title: 'Error',
          description: 'Failed to load replacement options',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadEditOptions();
    // usernames is intentionally not a dependency to avoid re-loading options on username updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, teamId, currentUserId, cellId, existingCells, toast]);

  /** Clears the loaded options, usernames and loading flag. */
  const reset = () => {
    setIsLoading(false);
    setEditOptions([]);
    setUsernames({});
  };

  return { editOptions, usernames, isLoading, reset };
};
