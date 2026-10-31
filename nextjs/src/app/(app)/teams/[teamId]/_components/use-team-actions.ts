import { useToast } from "@/hooks/use-toast";
import { unifiedToFormData } from "@/lib/shared/resolution-form";
import type { ResolutionFormData } from "@/lib/shared/types";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Team, TeamProvidedResolution } from "../types";

interface UseTeamActionsParams {
  teamId: string;
  initialTeam: Team;
  initialTeamGoal: ResolutionFormData | null;
  initialExistingResolutions: TeamProvidedResolution[];
}

/**
 * Owns the team detail data (team, team goal, member-provided resolutions) together with
 * the actions that reload or mutate it: load, start bingo and delete team.
 *
 * @param params - The team id and the server-fetched initial payloads.
 * @returns The current data, the actions and their loading flags.
 */
export function useTeamActions({
  teamId,
  initialTeam,
  initialTeamGoal,
  initialExistingResolutions,
}: UseTeamActionsParams) {
  const { toast } = useToast();
  const router = useRouter();
  // Initial team payload is server-fetched to avoid first-render client waterfalls.
  const [team, setTeam] = useState<Team>(initialTeam);
  const [teamGoal, setTeamGoal] = useState<ResolutionFormData | null>(initialTeamGoal);
  const [existingResolutions, setExistingResolutions] = useState<TeamProvidedResolution[]>(
    initialExistingResolutions
  );
  const [isStarting, setIsStarting] = useState(false);

  // Delete team dialog (open state lives here because a successful delete closes it)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /** Reloads the team, its goal and the member-provided resolutions from the API. */
  const loadTeam = useCallback(async () => {
    try {
      // Get team details
      const response = await fetch(`/api/teams/${teamId}`);
      const data = await response.json();

      if (response.ok) {
        setTeam(data.team);

        // Get team goal resolution
        const goalRes = await fetch(`/api/teams/${teamId}/goal`);
        const goalData = await goalRes.json();
        if (goalRes.ok && goalData.goal) {
          setTeamGoal(unifiedToFormData(goalData.goal));
        } else {
          setTeamGoal(null);
        }

        // Get existing member-provided resolutions
        const resRes = await fetch(`/api/teams/${teamId}/resolutions`);
        const resData = await resRes.json();
        if (resRes.ok) {
          setExistingResolutions(resData.createdByUser || []);
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load team",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An error occurred",
        variant: "destructive",
      });
    }
  }, [teamId, toast]);

  /** Starts the bingo game for the team, then reloads the team to show the cards. */
  const handleStartBingo = async () => {
    setIsStarting(true);
    const result = await apiFetch<unknown>(`/api/teams/${teamId}/start`, {
      method: 'POST',
    });

    if (result.ok) {
      toast({
        title: "Success",
        description: "Bingo game started!",
      });
      loadTeam(); // Reload to show cards
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to start game",
        variant: "destructive",
      });
    }
    setIsStarting(false);
  };

  /** Deletes the team; on success closes the dialog and navigates back to the teams list. */
  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/teams/${teamId}`,
        {
          method: 'DELETE',
        }
      );

      const data = await response
        .json()
        .catch(() => ({} as { error?: string }));

      if (response.ok) {
        setDeleteDialogOpen(false);
        toast({
          title: 'Team deleted',
          description: 'The team and its related data were removed.',
        });
        router.push('/teams');
        router.refresh();
        return;
      }

      toast({
        title: 'Error',
        description: data?.error || 'Failed to delete team',
        variant: 'destructive',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    team,
    teamGoal,
    existingResolutions,
    loadTeam,
    isStarting,
    handleStartBingo,
    deleteDialogOpen,
    setDeleteDialogOpen,
    isDeleting,
    handleDeleteTeam,
  };
}
