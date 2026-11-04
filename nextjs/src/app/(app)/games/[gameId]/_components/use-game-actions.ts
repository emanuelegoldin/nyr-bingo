import { useToast } from "@/hooks/use-toast";
import type { ResolutionFormData } from "@/lib/shared/types";
import { apiFetch, toastApiError } from "@/lib/api-client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { Game, TeamProvidedResolution } from "../types";
import { useLastLoaded } from "./use-last-loaded";

interface UseGameActionsParams {
  gameId: string;
  initialGame: Game;
  /** Undefined when the server failed to read it. */
  initialTeamGoal?: ResolutionFormData | null;
  /** Undefined when the server failed to read them. */
  initialExistingResolutions?: TeamProvidedResolution[];
}

/**
 * Exposes the game page data (game, team goal, member-provided resolutions) together with
 * the actions that refresh or mutate it: refresh, start bingo, end, delete and leave.
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
  // The server page loads the data; a refresh brings new props (also signalled over WebSocket).
  // A failed read keeps the last loaded value on screen.
  const game = useLastLoaded<Game>(initialGame, initialGame);
  const teamGoal = useLastLoaded<ResolutionFormData | null>(initialTeamGoal, null);
  const existingResolutions = useLastLoaded<TeamProvidedResolution[]>(initialExistingResolutions, []);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  /** Reloads the whole game page (game, goal, resolutions, cards, leaderboard) from the server. */
  const refreshGame = useCallback(() => {
    router.refresh();
  }, [router]);

  /** Starts the bingo game, then refreshes the page to show the cards. */
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
      refreshGame();
    } else {
      toastApiError(result, "Failed to start game");
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
      toastApiError(result, failureMessage);
    }
  };

  /** Ends the game, closing its open reviews. */
  const handleEndGame = async () => {
    setIsEnding(true);
    await leaveGameAfter(`/api/games/${gameId}/end`, 'POST', 'Game ended', 'Failed to end game');
    setIsEnding(false);
  };

  /** Leaves the game: the user's card and the resolutions written for them are removed. */
  const handleLeaveGame = async () => {
    setIsLeaving(true);
    await leaveGameAfter(`/api/games/${gameId}/leave`, 'POST', 'You left the game', 'Failed to leave game');
    setIsLeaving(false);
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
    refreshGame,
    isStarting,
    handleStartBingo,
    isEnding,
    handleEndGame,
    isDeleting,
    handleDeleteGame,
    isLeaving,
    handleLeaveGame,
  };
}
