/**
 * Compound Resolution Repository
 * Re-exports compound resolution functions from the unified resolution repository.
 * Kept for backward compatibility with existing API routes.
 */

export {
  createCompoundResolution,
  getCompoundResolutionsByUser,
  getCompoundResolutionById,
  updateCompoundResolution,
  toggleCompoundSubtask,
  deleteCompoundResolution,
} from './resolution-repository';
