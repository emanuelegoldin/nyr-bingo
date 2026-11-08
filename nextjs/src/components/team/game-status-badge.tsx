import { useTranslations } from "next-intl";

/**
 * Pill showing whether a game has started or is still in its preparation phase (stored as 'forming').
 * Spec Reference: 16-games.md - Lifecycle
 *
 * @param status - Game status value ('started' or 'forming').
 * @returns The status pill.
 */
export function GameStatusBadge({ status }: { status: string }) {
  const t = useTranslations("Teams");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status === 'started'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
      }`}>
      {status === 'started' ? t('gameStatus.started') : t('gameStatus.forming')}
    </span>
  );
}
