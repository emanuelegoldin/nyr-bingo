import { useToast } from "@/hooks/use-toast";
import { unifiedToFormData } from "@/lib/shared/resolution-form";
import type { ResolutionFormData } from "@/lib/shared/types";
import { apiFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Game, TeamProvidedResolution } from "../types";

interface UseGameActionsParams {
  gameId: string;
  initialGame: Game;
  /** Undefined when the server failed to read it. */
  initialTeamGoal?: ResolutionFormData | null;
  /** Undefined when the server failed to read them. */
  initialExistingResolutions?: TeamProvidedResolution[];
}

/**
 * Owns the game page data (game, team goal, member-provided resolutions) together with
 * the actions that reload or mutate it: load, start bingo, end and delete.
 *
 * @param params - The game id and the server-fetched initial payloads.
 * @returns The current data, the actions and their loading flags.
 */
export function useGameActions({
  gameId,
  initialGame,
  initialTeamGoal,
  initialExistingResolutions,
}: UseGameActionsParams) {
  const { toast } = useToast();
  const router = useRouter();
  // Initial game payload is server-fetched to avoid first-render client waterfalls.
  const [game, setGame] = useState<Game>(initialGame);
  const [teamGoal, setTeamGoal] = useState<ResolutionFormData | null>(initialTeamGoal ?? null);
  const [existingResolutions, setExistingResolutions] = useState<TeamProvidedResolution[]>(
    initialExistingResolutions ?? []
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // A server refresh brings new props (team changes signalled over WebSocket)
  useEffect(() => setGame(initialGame), [initialGame]);
  useEffect(() => {
    if (initialTeamGoal !== undefined) setTeamGoal(initialTeamGoal);
  }, [initialTeamGoal]);
  useEffect(() => {
    if (initialExistingResolutions) setExistingResolutions(initialExistingResolutions);
  }, [initialExistingResolutions]);

  /** Reloads the game, its goal and the member-provided resolutions from the API. */
  const loadGame = useCallback(async () => {
    try {
      // Get game details
      const response = await fetch(`/api/games/${gameId}`);
      const data = await response.json();

      if (response.ok) {
        setGame(data.game);

        // Get team goal resolution
        const goalRes = await fetch(`/api/games/${gameId}/goal`);
        const goalData = await goalRes.json();
        if (goalRes.ok && goalData.goal) {
          setTeamGoal(unifiedToFormData(goalData.goal));
        } else {
          setTeamGoal(null);
        }

        // Get existing member-provided resolutions
        const resRes = await fetch(`/api/games/${gameId}/resolutions`);
        const resData = await resRes.json();
        if (resRes.ok) {
          setExistingResolutions(resData.createdByUser || []);
        }
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load game",
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
  }, [gameId, toast]);

  /** Starts the bingo game, then reloads it to show the cards. */
  const handleStartBingo = async () => {
    setIsStarting(true);
    const result = await apiFetch<unknown>(`/api/games/${gameId}/start`, {
      method: 'POST',
    });

    if (result.ok) {
      toast({
        title: "Success",
        description: "Bingo game started!",
      });
      loadGame(); // Reload to show cards
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || "Failed to start game",
        variant: "destructive",
      });
    }
    setIsStarting(false);
  };

  /**
   * Runs an action that removes the game from view, then returns to the games list.
   *
   * @param path - The API route to call.
   * @param method - The HTTP method.
   * @param successTitle - Toast title shown on success.
   * @param failureMessage - Toast text when the API gives no reason.
   */
  const leaveGameAfter = async (
    path: string,
    method: 'POST' | 'DELETE',
    successTitle: string,
    failureMessage: string,
  ) => {
    const result = await apiFetch<unknown>(path, { method });

    if (result.ok) {
      toast({ title: successTitle });
      router.push('/games');
      router.refresh();
    } else {
      toast({
        title: "Error",
        description: result.status === 0 ? "An error occurred" : result.error || failureMessage,
        variant: "destructive",
      });
    }
  };

  /** Ends the game, closing its open reviews. */
  const handleEndGame = async () => {
    setIsEnding(true);
    await leaveGameAfter(`/api/games/${gameId}/end`, 'POST', 'Game ended', 'Failed to end game');
    setIsEnding(false);
  };

  /** Deletes the game and everything in it. */
  const handleDeleteGame = async () => {
    setIsDeleting(true);
    await leaveGameAfter(`/api/games/${gameId}`, 'DELETE', 'Game deleted', 'Failed to delete game');
    setIsDeleting(false);
  };

  return {
    game,
    teamGoal,
    existingResolutions,
    loadGame,
    isStarting,
    handleStartBingo,
    isEnding,
    handleEndGame,
    isDeleting,
    handleDeleteGame,
  };
}
