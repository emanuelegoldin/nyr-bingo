/**
 * Leaderboard rank colours — gold / silver / bronze accents for positions 1–3.
 * Spec Reference: 12-team-tabs.md - Leaderboard Tab
 */

/**
 * Map a 1-indexed rank to a text colour class.
 * @param rank - The player's position (1-indexed).
 * @returns Tailwind classes for the rank's text colour.
 */
export const rankColorClass = (rank: number): string => {
  switch (rank) {
    case 1:
      return "text-yellow-500 dark:text-yellow-400"; // gold
    case 2:
      return "text-gray-400 dark:text-gray-300"; // silver
    case 3:
      return "text-amber-700 dark:text-amber-500"; // bronze
    default:
      return "text-muted-foreground";
  }
};

/**
 * Map a podium rank (1–3) to a border colour class for its card.
 * @param rank - The player's position (1-indexed).
 * @returns Tailwind classes for the card's border colour.
 */
export const rankBorderClass = (rank: number): string => {
  switch (rank) {
    case 1:
      return "border-yellow-500 dark:border-yellow-400";
    case 2:
      return "border-gray-400 dark:border-gray-300";
    case 3:
      return "border-amber-700 dark:border-amber-500";
    default:
      return "";
  }
};
