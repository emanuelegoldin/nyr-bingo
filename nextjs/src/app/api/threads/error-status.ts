/**
 * Map a review thread failure to its HTTP status.
 * Spec Reference: 07-proof-and-approval.md
 *
 * @param error - The error message returned by the review repositories.
 * @returns 404 for a missing record, 403 for an authorization failure, otherwise 400.
 */
export function threadErrorStatus(error: string): 400 | 403 | 404 {
  if (error.endsWith(' not found')) return 404;
  if (error.startsWith('Only ') || error.startsWith('Completing user ')) return 403;
  return 400;
}
