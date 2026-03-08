/**
 * Iterative Resolution Repository
 * Re-exports iterative resolution functions from the unified resolution repository.
 * Kept for backward compatibility with existing API routes.
 */

export {
  createIterativeResolution,
  getIterativeResolutionsByUser,
  getIterativeResolutionById,
  updateIterativeResolution,
  incrementIterativeResolution,
  decrementIterativeResolution,
  deleteIterativeResolution,
} from './resolution-repository';
