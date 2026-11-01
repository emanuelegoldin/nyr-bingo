/**
 * Server startup hook, called once by Next.js.
 * Spec Reference: 07-proof-and-approval.md - Closure by Deadline
 */

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

/** Start the hourly sweep that closes review threads past their deadline. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { closeExpiredThreads } = await import('@/lib/db/review-thread-repository');
  const { notifyThreadClosed } = await import('@/lib/team-signals');

  const sweep = async (): Promise<void> => {
    try {
      const closedThreadIds = await closeExpiredThreads();
      await Promise.all(closedThreadIds.map(notifyThreadClosed));
    } catch (error) {
      console.error('Failed to sweep expired review threads:', error);
    }
  };

  void sweep();
  setInterval(sweep, SWEEP_INTERVAL_MS);
}
