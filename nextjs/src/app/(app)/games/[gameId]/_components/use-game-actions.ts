import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import type { ResolutionFormData } from "@/lib/shared/types";
import { useTranslations } from "next-intl";
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
 * the actions that refresh or mutate it: refresh, end, delete and leave.
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
  const t = useTranslations("Games.actions");
  const toastApiError = useApiErrorToast();
  const router = useRouter();
  // The server page loads the data; a refresh brings new props (also signalled over WebSocket).
  // A failed read keeps the last loaded value on screen.
  const game = useLastLoaded<Game>(initialGame, initialGame);
  const teamGoal = useLastLoaded<ResolutionFormData | null>(initialTeamGoal, null);
  const existingResolutions = useLastLoaded<TeamProvidedResolution[]>(initialExistingResolutions, []);
  const [isEnding, setIsEnding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  /** Reloads the whole game page (game, goal, resolutions, cards, leaderboard) from the server. */
  const refreshGame = useCallback(() => {
    router.refresh();
  }, [router]);

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
    await leaveGameAfter(`/api/games/${gameId}/end`, 'POST', t('ended'), t('endFailed'));
    setIsEnding(false);
  };

  /** Leaves the game: the user's card and the resolutions written for them are removed. */
  const handleLeaveGame = async () => {
    setIsLeaving(true);
    await leaveGameAfter(`/api/games/${gameId}/leave`, 'POST', t('left'), t('leaveFailed'));
    setIsLeaving(false);
  };

  /** Deletes the game and everything in it. */
  const handleDeleteGame = async () => {
    setIsDeleting(true);
    await leaveGameAfter(`/api/games/${gameId}`, 'DELETE', t('deleted'), t('deleteFailed'));
    setIsDeleting(false);
  };

  return {
    game,
    teamGoal,
    existingResolutions,
    refreshGame,
    isEnding,
    handleEndGame,
    isDeleting,
    handleDeleteGame,
    isLeaving,
    handleLeaveGame,
  };
}
