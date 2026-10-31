/**
 * Pill showing whether a team's game has started or the team is still forming.
 *
 * @param status - Team status value ('started' or 'forming').
 * @returns The status pill.
 */
export function TeamStatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status === 'started'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      }`}>
      {status === 'started' ? 'Game Started' : 'Forming Team'}
    </span>
  );
}
