/**
 * The number of personal resolutions a player needs to fill their card.
 * Spec Reference: 03-personal-resolutions.md - Personal Target
 */

/**
 * Count the cells left for a player's own resolutions: every position minus the Joker, the team goal and one
 * resolution from each other player.
 *
 * @param gridSize - The side length of the game's cards (3, 5 or 9).
 * @param playerCount - The number of players of the game.
 * @returns gridSize² − playerCount − 1, never below 0.
 */
export const getPersonalResolutionTarget = (gridSize: number, playerCount: number): number =>
  Math.max(0, gridSize * gridSize - playerCount - 1);
