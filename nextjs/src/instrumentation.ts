/**
 * Server startup hook, called once by Next.js.
 * Spec Reference: 07-proof-and-approval.md - Closure by Deadline, 16-games.md - Ending a Game,
 * 19-notifications.md - Release
 */

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
const NOTIFICATION_RELEASE_INTERVAL_MS = 5 * 1000;

/**
 * Start the hourly sweep that ends games and closes review threads past their deadline, and the
 * loop that releases notifications.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { closeExpiredThreads } = await import('@/lib/db/review-thread-repository');
  const { notifyThreadClosed } = await import('@/lib/team-signals');
  const { archiveEndedGames, finishExpiredGames } = await import('@/lib/game-ending');
  const { releaseDueNotifications } = await import('@/lib/notifications/dispatcher');

  const sweep = async (): Promise<void> => {
    try {
      await finishExpiredGames();
    } catch (error) {
      console.error('Failed to sweep expired games:', error);
    }

    try {
      await archiveEndedGames();
    } catch (error) {
      console.error('Failed to sweep ended games:', error);
    }

    try {
      const closedThreadIds = await closeExpiredThreads();
      await Promise.all(closedThreadIds.map(notifyThreadClosed));
    } catch (error) {
      console.error('Failed to sweep expired review threads:', error);
    }
  };

  void sweep();
  setInterval(sweep, SWEEP_INTERVAL_MS);

  setInterval(() => {
    releaseDueNotifications().catch((error) => {
      console.error('Failed to release notifications:', error);
    });
  }, NOTIFICATION_RELEASE_INTERVAL_MS);
}
